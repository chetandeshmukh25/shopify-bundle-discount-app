import shopify from "../shopify.server";

import type { GraphQLError } from "graphql";

export const BUNDLE_METAOBJECT_TYPE = "bundle:bundle";

type MetaobjectDefinition = {
  id: string;
  handle: string;
  name: string;
};

/**
 * Ensures the Bundle metaobject definition exists.
 * If it already exists, returns the existing definition.
 * If not, creates it and returns the created definition.
 *
 * Uses the Admin GraphQL API. Requires an authenticated admin session.
 */
export async function ensureBundleMetaobjectDefinition(admin: any) {
  // 1. Check existing definitions by type
  const query = `#graphql
    query bundleMetaobjectDefinitions($type: String!) {
      metaobjectDefinitions(first: 50, type: $type) {
        edges {
          node {
            id
            handle
            name
            type
          }
        }
      }
    }
  `;

  const res = await admin.graphql(query, { variables: { type: BUNDLE_METAOBJECT_TYPE } });
  const json = await res.json();

  if (json.errors) {
    // let caller handle errors
    throw json.errors as GraphQLError[];
  }

  const edges = json.data?.metaobjectDefinitions?.edges ?? [];
  if (edges.length > 0) {
    // return first matching definition
    const node = edges[0].node;
    return { id: node.id, handle: node.handle, name: node.name } as MetaobjectDefinition;
  }

  // 2. Create definition if not found
  const mutation = `#graphql
    mutation createBundleMetaobjectDefinition($definition: MetaobjectDefinitionInput!) {
      metaobjectDefinitionCreate(definition: $definition) {
        definition {
          id
          handle
          name
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const definitionInput = {
    name: "Bundle",
    type: BUNDLE_METAOBJECT_TYPE,
    handle: "bundle",
    fields: [
      { key: "name", name: "Name", type: "single_line_text_field", required: true },
      { key: "products", name: "Products", type: "product_reference", required: true, list: true },
      { key: "discount_type", name: "Discount type", type: "single_line_text_field" },
      { key: "discount_value", name: "Discount value", type: "number_integer" },
      { key: "status", name: "Status", type: "single_line_text_field" },
    ],
  };

  const createRes = await admin.graphql(mutation, { variables: { definition: definitionInput } });
  const createJson = await createRes.json();

  if (createJson.errors) throw createJson.errors;

  const userErrors = createJson.data?.metaobjectDefinitionCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    // if userErrors indicate a duplicate handle/type, re-query and return existing
    // otherwise throw
    const duplicate = userErrors.find((e: any) => /already exists|duplicate/i.test(e.message));
    if (duplicate) {
      // re-query
      const retryRes = await admin.graphql(query, { variables: { type: BUNDLE_METAOBJECT_TYPE } });
      const retryJson = await retryRes.json();
      const retryEdges = retryJson.data?.metaobjectDefinitions?.edges ?? [];
      if (retryEdges.length > 0) {
        const node = retryEdges[0].node;
        return { id: node.id, handle: node.handle, name: node.name } as MetaobjectDefinition;
      }
    }
    throw userErrors;
  }

  const def = createJson.data.metaobjectDefinitionCreate.definition;
  return { id: def.id, handle: def.handle, name: def.name } as MetaobjectDefinition;
}

/**
 * Public helper that accepts the request session via the project's shopify helper.
 * Example usage:
 *   const { admin } = await authenticate.admin(request);
 *   await ensureBundleMetaobjectDefinition(admin);
 */
export async function ensureBundleDefinitionForRequest(request: Request) {
  const auth = await shopify.authenticate.admin(request as any);
  const admin = auth.admin;
  if (!admin) throw new Error("Admin client unavailable");
  return ensureBundleMetaobjectDefinition(admin);
}
