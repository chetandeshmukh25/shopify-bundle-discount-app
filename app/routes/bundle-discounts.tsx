import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useFetcher, useLoaderData, Form, redirect, useNavigation, Link } from "react-router";
import { useEffect } from "react";
import { authenticate } from "../shopify.server";

type LoaderData = {
  bundles: BundleRow[];
  error?: string | null;
};

type BundleRow = {
  id: string;
  name: string;
  products: string[];
  discount: string;
  status: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const query = `#graphql
    query listBundles($type: String!, $first: Int!) {
      metaobjects(type: $type, first: $first) {
        edges {
          node {
            id
            handle
            type
            fields {
              key
              value
            }
          }
        }
      }
    }
  `;

  const res = await admin.graphql(query, { variables: { type: "bundle:bundle", first: 250 } });
  const json = await res.json();

  if ((json as any).errors) {
    return { bundles: [], error: "Failed to load bundles" } as LoaderData;
  }

  const edges = json.data?.metaobjects?.edges ?? [];

  const bundles: BundleRow[] = edges.map((e: any) => {
    const node = e.node;
    const fields: Record<string, any> = {};
    for (const f of node.fields || []) fields[f.key] = f.value;

    // products may be stored as a JSON string of ids
    let products: string[] = [];
    try {
      const parsed = JSON.parse(fields.products ?? "null");
      if (Array.isArray(parsed)) products = parsed;
      else if (typeof fields.products === "string" && fields.products) products = [fields.products];
    } catch {
      if (typeof fields.products === "string" && fields.products) products = [fields.products];
    }

    let discount = "";
    if (fields.discount_type && fields.discount_value) {
      discount = fields.discount_type === "percentage" ? `${fields.discount_value}%` : `${fields.discount_value}`;
    } else if (fields.discount_value) {
      discount = `${fields.discount_value}`;
    }

    return {
      id: node.id,
      name: fields.name ?? node.handle ?? "",
      products,
      discount,
      status: fields.status ?? "",
    } as BundleRow;
  });

  return { bundles } as LoaderData;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const _action = form.get("_action")?.toString();

  if (_action === "delete") {
    const id = form.get("id")?.toString();
    if (!id) return redirect("/bundle-discounts");

    const { admin } = await authenticate.admin(request);
    const mutation = `#graphql
      mutation deleteMetaobject($id: ID!) {
        metaobjectDelete(id: $id) {
          deletedId
          userErrors { field message }
        }
      }
    `;

    const res = await admin.graphql(mutation, { variables: { id } });
    const json = await res.json();
    if ((json as any).errors) {
      // surface error by redirecting back with a query param (simple approach)
      return redirect("/bundle-discounts?error=delete_failed");
    }

    const userErrors = json.data?.metaobjectDelete?.userErrors ?? [];
    if (userErrors.length > 0) return redirect("/bundle-discounts?error=delete_failed");

    return redirect("/bundle-discounts");
  }

  return redirect("/bundle-discounts");
};

export default function BundleDiscounts() {
  const data = useLoaderData() as LoaderData;
  const fetcher = useFetcher();
  const navigation = useNavigation();

  const isSubmitting = navigation.state !== "idle" || fetcher.state !== "idle";

  return (
    <s-page heading="Bundle Discounts">
      <Link to="/bundle-discounts/create">
        <s-button slot="primary-action">Create Bundle</s-button>
      </Link>

      <s-section>
        {isSubmitting && <s-paragraph>Loading…</s-paragraph>}

        {data.error && <s-paragraph>{data.error}</s-paragraph>}

        {!data.error && data.bundles.length === 0 && (
          <s-paragraph>No bundles found. Create one to get started.</s-paragraph>
        )}

        {!data.error && data.bundles.length > 0 && (
          <s-table>
            <thead>
              <tr>
                <th>Bundle Name</th>
                <th>Products</th>
                <th>Discount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.bundles.map((b) => (
                <tr key={b.id}>
                  <td>{b.name}</td>
                  <td>{b.products.join(", ")}</td>
                  <td>{b.discount}</td>
                  <td>{b.status}</td>
                  <td>
                    <s-stack direction="inline" gap="base">
                      <Link to={`/bundle-discounts/create?id=${encodeURIComponent(b.id)}`}>
                        <s-button variant="tertiary">Edit</s-button>
                      </Link>

                      <Form method="post">
                        <input type="hidden" name="_action" value="delete" />
                        <input type="hidden" name="id" value={b.id} />
                        <s-button type="submit" variant="tertiary">Delete</s-button>
                      </Form>
                    </s-stack>
                  </td>
                </tr>
              ))}
            </tbody>
          </s-table>
        )}
      </s-section>
    </s-page>
  );
}
