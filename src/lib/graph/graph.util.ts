
export interface QueryCondition {
    where?: any;
    offset?: number;
    args?: any;
    distinct_on?: any;
    limit?: number;
    order_by?: any[];
}

export interface GraphType {
    alias: string;
    name: string;
    fields: string;
    functionName: string;
}

export type GraphTypeCreator = (alias?: string) => GraphType;

export function createGraphType(name: string, fields: string, functionName?: string): GraphTypeCreator {
    return (alias = name) => ({
        name, fields, functionName, alias: alias ?? name
    });
}

export interface GraphQLStatement {
    gql: string;
    parameters: string[];
    variables: any;
    context?: GraphRequestContext;
}

export type QueryQLStatementFunction = (i: any) => GraphQLStatement;
export type MutationQLStatementFunction = (i: any) => GraphQLStatement;
export type GraphRequestContext = {
  headers?: Record<string, any>,
  [key: string]: any,
};

const retainUndefined = (data) => data ? ((o) => !!o ? JSON.parse(o) : undefined)(JSON.stringify(data, (k, v) => v === undefined ? null : v)) : undefined;

export function queryQl(type: GraphType,  condition: QueryCondition = {}, context: GraphRequestContext = null): QueryQLStatementFunction  {
    const alias = type.alias ? `${type.alias}:` : '';
    const typeName = type.functionName || type.name;
    return (i: any) => {
        const argsQl = !!condition.args ?  `args: $args_${i},` : '';
        const gql = `${alias} ${typeName} (${argsQl} where: $where_${i}, offset: $offset_${i}, limit: $limit_${i}, order_by: $order_by_${i}, distinct_on: $distinct_on_${i}) {
            ${type.fields}
        }`;

        const options: any = {
            gql,
            parameters: [
                `$where_${i}: ${type.name}_bool_exp`,
                `$offset_${i}: Int`,
                `$limit_${i}: Int`,
                `$order_by_${i}: [${type.name}_order_by!]`,
                `$distinct_on_${i}: [${type.name}_select_column!]`
            ],
            variables: { 
                [`where_${i}`]: retainUndefined(condition.where),
                [`offset_${i}`]: condition.offset,
                [`limit_${i}`]: condition.limit,
                [`order_by_${i}`]: condition.order_by,
                [`distinct_on_${i}`]: condition.distinct_on
            },
            context,
        };

        if (condition.args) {
            options.parameters.push(`$args_${i}: ${typeName}_args!`);
            options.variables[`args_${i}`] = condition.args
        }

        return options;
    };
}

export function aggregateQl(type: GraphType, aggregate: string, where?: any, context: GraphRequestContext = null): QueryQLStatementFunction {
    const alias = type.alias ? `${type.alias}:` : '';
    return (i) => {
        const gql = `${alias} ${type.name}_aggregate (where: $where_${i}) {
            ${aggregate}
        }`;

        return {
            gql,
            parameters: [
                `$where_${i}: ${type.name}_bool_exp`
            ],
            variables: {
                [`where_${i}`]: ((where) => where ? JSON.parse(where) : undefined)(JSON.stringify(where, (k, v) => v === undefined ? null : v)),
            },
            context,
        }
    };
}

export function insertQl(type: GraphType, data: { objects: any | any[], on_conflict?: any }, context: GraphRequestContext = null): MutationQLStatementFunction {
    const objects = Array.isArray(data.objects) ? data.objects : [data.objects];
    const alias = type.alias ? `${type.alias}:` : '';
    return (i) => {
        const onConflict = !!data.on_conflict ? `on_conflict: $on_conflict_${i}` : '';
        const gql = `
            ${alias} insert_${type.name}(${onConflict} objects: $entities_${i}) {
                affected_rows
                returning {
                    ${type.fields}
                }
            }
        `;
        const options: any = {
            gql,
            parameters: [
                `$entities_${i}: [${type.name}_insert_input!]!`
            ],
            variables: {
                [`entities_${i}`]: objects
            },
            context,
        };

        if(data.on_conflict) {
            options.parameters.push(`$on_conflict_${i}: ${type.name}_on_conflict`);
            options.variables[`on_conflict_${i}`] = data.on_conflict;
        }

        return options;
    };
}

export function updateQl(type: GraphType, data: { set?: any, where?: any, jsonAppend?: any }, context: GraphRequestContext = null): MutationQLStatementFunction {
    const alias = type.alias ? `${type.alias}:` : '';
    return (i) => {
        const gql = `${alias} update_${type.name}(
            _set: $entity_${i}, where: $where_${i} ${data.jsonAppend ? `, _append: $append_${i}` : ''}
          ) {
            affected_rows
            returning {
                ${type.fields}
            }
        }`;

        return {
            gql,
            parameters: [
                `$entity_${i}: ${type.name}_set_input!`,
                `$where_${i}: ${type.name}_bool_exp!`,
                ...(data.jsonAppend ? [`$append_${i}: ${type.name}_append_input`] : []),
            ],
            variables: {
                [`entity_${i}`]: data.set,
                [`where_${i}`]: retainUndefined(data.where),
                ...(data.jsonAppend ? { [`append_${i}`]: retainUndefined(data.jsonAppend) } : {}),
            },
            context,
        };
    }
}

export function deleteQl(type: GraphType, where: any, context: GraphRequestContext = null): MutationQLStatementFunction {
    const alias = type.alias ? `${type.alias}:` : '';
    return (i) => {
        const gql = `${alias} delete_${type.name} (where: $where_${i}) {
                        returning {
                            ${type.fields}
                        }
                    }`;

        return {
            gql,
            parameters: [
                `$where_${i}: ${type.name}_bool_exp!`
            ],
            variables: {
                [`where_${i}`]: retainUndefined(where)
            },
            context,
        }
    };
}
