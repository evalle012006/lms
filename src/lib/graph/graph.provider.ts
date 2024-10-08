import { _ApolloClient as ApolloClient, _InMemoryCache as InMemoryCache, _HttpLink as HttpLink, _gql as gql } from './apollo';
import { GraphQLStatement, MutationQLStatementFunction, QueryQLStatementFunction } from './graph.util';

export type GraphResult = Promise<{ data?: Record<string, any>, errors?: Error[] }>;

export class GraphProvider {

    public readonly apollo: (typeof ApolloClient);

    constructor() {
        const cache = new InMemoryCache({ addTypename: false });
        const link = new HttpLink({
            uri: process.env.HASURA_URL + '/v1/graphql',
            fetch: (reqInfo, init: any) => {
                if(!init.headers['Authorization']) {
                    init.headers['x-hasura-admin-secret'] = process.env.HASURA_ADMIN_SECRET;
                }
                return fetch(reqInfo, init);
            },
        });

        this.apollo = new ApolloClient({ cache, link, defaultOptions: {
            query: {
                fetchPolicy: 'no-cache',
                errorPolicy: 'all',
            },
            watchQuery: {
                fetchPolicy: 'no-cache',
                errorPolicy: 'ignore',
            },
        }});

    }

    private statement(statements: QueryQLStatementFunction[] | MutationQLStatementFunction[]) {
        const preparedStatements = statements.map((m, i) => m(i) as GraphQLStatement);
        const types = preparedStatements.reduce((c, e) => [... c, ... e.parameters], []).join(', ');
        const gql = preparedStatements.reduce((c, e) => [... c, e.gql], []).join(' \n ');
        const variables = preparedStatements.reduce((c, e) => ({ ...c, ... e.variables }), {});
        const context = preparedStatements.reduce((c, e) => ({ ...c, ...e.context }), {});

        return {
            types,
            gql,
            variables,
            context,
        }
    }

    query(... statements: QueryQLStatementFunction[]): GraphResult {
        const resp = this.statement(statements);
        return this.apollo.query({
            query: gql`
                query (${resp.types}) {
                    ${resp.gql}
                }
            `,
            variables: resp.variables,
            context: resp.context,
        }).then(resp => {
            if(resp.errors) {
                throw resp.errors;
            }
            return resp;
        })
    }

    mutation(... statements: MutationQLStatementFunction[]): GraphResult {
        const resp = this.statement(statements);
        return this.apollo.mutate({
            mutation: gql`
                mutation (${resp.types}) {
                    ${resp.gql}
                }
            `,
            variables: resp.variables,
            context: resp.context,
        }).then(resp => {
            if(resp.errors) {
                throw resp.errors;
            }
            return resp;
        })
    }

    subscription(statement: QueryQLStatementFunction) {
        const resp = this.statement([statement]);
        return this.apollo.subscribe({
            query: gql`
                subscription (${resp.types}) {
                    ${resp.gql}
                }
            `,
            variables: resp.variables,
        })
    }

}
