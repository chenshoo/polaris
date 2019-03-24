import { PolarisLogger } from '@enigmatis/polaris-logs';
import { ApolloServer, Config, makeExecutableSchema } from 'apollo-server-koa';
import { applyMiddleware } from 'graphql-middleware';
import { inject, injectable, multiInject } from 'inversify';
import * as Koa from 'koa';
import * as koaBody from 'koa-bodyparser';
import { PolarisServerConfig } from '../common/injectable-interfaces';
import { getHeaders } from '../http/request/polaris-request-headers';
import { POLARIS_TYPES } from '../inversion-of-control/polaris-types';
import { Middleware } from '../middlewares/middleware';
import { createMiddleware } from '../middlewares/polaris-middleware-creator';
import { PolarisProperties } from '../properties/polaris-properties';
import { SchemaCreator } from '../schema/utils/schema-creator';
import { ExtensionContextBuilder } from './extension-context-builder';
import { PolarisContext } from './polaris-context';

const app = new Koa();
app.use(koaBody());

export interface GraphQLServer {
    start(): void;
}

@injectable()
export class PolarisGraphQLServer implements GraphQLServer {
    @inject(POLARIS_TYPES.GraphqlLogger) polarisLogger!: PolarisLogger;
    private server: ApolloServer;
    private polarisProperties: PolarisProperties;

    constructor(
        @inject(POLARIS_TYPES.SchemaCreator) creator: SchemaCreator,
        @inject(POLARIS_TYPES.PolarisServerConfig) propertiesConfig: PolarisServerConfig,
        @multiInject(POLARIS_TYPES.Middleware) middlewares: Middleware[],
    ) {
        const schema = creator.generateSchema();
        const executableSchemaDefinition: { typeDefs: any; resolvers: any } = {
            typeDefs: schema.def,
            resolvers: schema.resolvers,
        };

        const executableSchema = makeExecutableSchema(executableSchemaDefinition);

        const executableSchemaWithMiddlewares = applyMiddleware(
            executableSchema,
            ...(middlewares.map(createMiddleware) as any),
        );
        this.polarisProperties = propertiesConfig.polarisProperties;
        const config: Config = {
            schema: executableSchemaWithMiddlewares,
            extensions: [() => new ExtensionContextBuilder()],
            context: ({ ctx }: { ctx: Koa.Context }): PolarisContext => {
                try {
                    const headers = getHeaders(ctx.request.headers);
                    return {
                        headers,
                        body: ctx.request.body,
                        extensions: {},
                    };
                } catch (e) {
                    this.polarisLogger.error('Headers error', { throwable: e });
                    throw new Error('Unable to format headers');
                }
            },
            formatError: (error: any) => {
                if (error.extensions && error.extensions.code === 'GRAPHQL_VALIDATION_FAILED') {
                    return error;
                } else {
                    this.polarisLogger.error('Apollo server error', { throwable: error });
                    return new Error('Internal server error');
                }
            },

            formatResponse: (response: any, { ctx }: { ctx: Koa.Context }) => {
                if (!response.data.__schema && !response.data.__type) {
                    this.polarisLogger.info(
                        `Finished response, answer is ${JSON.stringify(response)}`,
                    );
                }

                return response;
            },
        };
        this.server = new ApolloServer(config);
        if (this.polarisProperties.endpoint) {
            this.server.applyMiddleware({ app, path: this.polarisProperties.endpoint });
        } else {
            this.server.applyMiddleware({ app });
        }
    }

    start() {
        const port = this.polarisProperties.port;
        app.listen(port, () => {
            this.polarisLogger.info(
                `🚀 Server ready at http://localhost:${port}${this.server.graphqlPath}`,
            );
        });
    }
}
