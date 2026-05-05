import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { ApolloServerPluginLandingPageLocalDefault } from "@apollo/server/plugin/landingPage/default";
import { gateway } from "./gateway.js";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
dotenv.config();

const server = new ApolloServer({
  gateway,
  csrfPrevention: false,
  plugins: [
    ApolloServerPluginLandingPageLocalDefault({
      embed: true,
    }),
  ],
});

startStandaloneServer(server, {
  listen: { port: 4000, host: "0.0.0.0" },

  cors: {
    origin: "*",
    credentials: true,
  },

  path: "/graphql",

  context: async ({ req }) => {
    console.log("Incoming headers:", req.headers); //  DEBUG

    const authHeader = req.headers.authorization;

    //  Step 1: Check header exists
    if (!authHeader) {
      console.log(" No Authorization header");
      return { user: null };
    }

    try {
      //  Step 2: Extract token properly
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : authHeader;

      console.log("Token received:", token); //  DEBUG

      //  Step 3: Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      console.log("Decoded user:", decoded); //  DEBUG

      return {
        user: decoded, //  IMPORTANT
      };
    } catch (err) {
      console.log("Invalid token:", err.message);
      return { user: null };
    }
  },
}).then(() => {
  console.log("Main Service running on http://0.0.0.0:4000/graphql");
});
