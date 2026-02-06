This is main-service...

This is main-service...

This is a GraphQL microservices architecture using Apollo Federation, where multiple backend services behave like one unified GraphQL API.

A client sends a graphql query or mutation includes a JWT in the Authorization header.The client always calls only one URL, which is the Apollo Gateway.

The Apollo Gateway is the single public entry point and acts as the brain of the system. When a request arrives gateway parses graphql query. It verifies the JWT. If it is valid it decodes the user data. And it stores the data in context.user.

If JWT is invalid the user treated as unauthenticated. At this point authentication is done once and user identity is now trusted.

Before handling requests gateway fetches schemas from all subgraph services.These schemas are composed into one schema.The client sees a single Graphql API.

After authentication gateway analyzes incoming query and creates a query plan.It determines which fields belong to which subgraph the correct order to fetch data.

Before forwarding subqueries gateway takes context.user injects it as trusted internal header(x-user).Sends subqueries to the appropriate subgraph services. JWT itself is not forwarded. Only verified user data is forwarded. This prevents duplicated authentication logic.

Each subgraph service runs its own Apollo Server owns its schema,resolvers and database reads user into from x-user trusts the gateway completely. Subgraph services do not verify JWTs do not know about other services Focus only on business logic and data.

Resolvers execute SQL or other data access logic. Authorization checks happen at resolver level. Data is fetched and returned to the gateway. Each service owns its data can scale independtly can evolve its schema independently.

The gateway collects all partial responses. Merges them into a single GraphQL response. It sends one JSON response back to the client. The client receives one response. Never sees service boundaries and never makes multiple requests.

Security is enforced by design. JWT verification happens only once.Subqueries are not publicly acccessible. Each layer has a single responsibility client holds token, gateway verifies identity, subgraphs trust the gateway ,network prevents direct access.

This type architecture is used because this architecture is used to solve auth duplication, frontend complexity, tight service coupling,scaling problems. It provides centraalized authentication clear data ownership independent service scaling.

Summary : The Apollo Gateway authenticates and routes requests, subgraph services own and resolve data, and Apollo Federation makes many services behave like one GraphQL API.
