import express from 'express';
import cors from 'cors';
import { graphqlExpress, graphiqlExpress } from 'apollo-server-express';
import bodyParser from 'body-parser';
import schema from './data/schema';

const port = process.env.PORT || 3030;
// const GRAPHQL_PORT = 3030;

const graphQLServer = express();

graphQLServer.use(cors());
// graphQLServer.use('*', cors({ origin: 'http://localhost:3000' }));

graphQLServer.use('/graphql', bodyParser.json(), graphqlExpress({ schema }));
graphQLServer.use('/graphiql', graphiqlExpress({ endpointURL: '/graphql' }));

graphQLServer.listen(port, () =>
  console.log(`GraphiQL is now running on http://localhost:${port}/graphiql`)
);
