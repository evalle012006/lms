import { _ApolloClient as ApolloClient, _InMemoryCache as InMemoryCache, _HttpLink as HttpLink, _gql as gql } from './apollo';
import { GraphQLStatement, MutationQLStatementFunction, QueryQLStatementFunction } from './graph.util';

export type GraphResult = Promise<{
    data?: Record<string, any>;
    errors?: readonly Error[];
}>;

export class GraphProvider {

    public readonly apollo: InstanceType<typeof ApolloClient>;

    constructor() {
        const cache = new InMemoryCache({ addTypename: false });
        const link = new HttpLink({
            uri: process.env.HASURA_URL + '/v1/graphql',
            fetch: (reqInfo, init: any) => {
                const headers = new Headers(init?.headers || {});

                if (!headers.has('Authorization')) {
                    if (!process.env.HASURA_ADMIN_SECRET) {
                        throw new Error('HASURA_ADMIN_SECRET is not configured');
                    }

                    headers.set(
                        'x-hasura-admin-secret',
                        process.env.HASURA_ADMIN_SECRET
                    );
                }

                return fetch(reqInfo, {
                    ...init,
                    headers,
                });
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

    private statement(
        statements: QueryQLStatementFunction[] | MutationQLStatementFunction[]
    ) {
        const preparedStatements: GraphQLStatement[] = statements.map(
            (statement, index) => statement(index) as GraphQLStatement
        );

        const types = preparedStatements
            .flatMap((statement) => statement.parameters)
            .join(", ");

        const gql = preparedStatements
            .map((statement) => statement.gql)
            .join("\n");

        const variables = preparedStatements.reduce<Record<string, any>>(
            (result, statement) => ({
                ...result,
                ...statement.variables,
            }),
            {}
        );

        const context = preparedStatements.reduce<Record<string, any>>(
            (result, statement) => ({
                ...result,
                ...statement.context,
            }),
            {}
        );

        return {
            types,
            gql,
            variables,
            context,
        };
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
