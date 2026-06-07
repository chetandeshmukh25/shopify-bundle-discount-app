import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { redirect, Form, useActionData } from "react-router";
import { authenticate } from "../../../shopify.server";
import { ensureBundleMetaobjectDefinition, BUNDLE_METAOBJECT_TYPE } from "../../../services/bundles.server";

type ActionData = { errors?: Record<string, string> };

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return null;
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const form = await request.formData();
  const name = form.get("name")?.toString() ?? "";
  const productsRaw = form.get("products")?.toString() ?? "";
  const discount_type = form.get("discount_type")?.toString() ?? "";
  const discount_value = form.get("discount_value")?.toString() ?? "";
  const status = form.get("status")?.toString() ?? "inactive";

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required";
  if (!productsRaw) errors.products = "At least one product id is required";

  if (Object.keys(errors).length > 0) {
    return { errors } as ActionData;
  }

  // parse product ids (comma separated)
  const productIds = productsRaw.split(",").map((p) => p.trim()).filter(Boolean);

  const { admin } = await authenticate.admin(request);

  // ensure metaobject definition exists (idempotent)
  await ensureBundleMetaobjectDefinition(admin);

  // create the metaobject entry
  const mutation = `#graphql
    mutation createBundleMetaobject($metaobject: MetaobjectInput!) {
      metaobjectCreate(metaobject: $metaobject) {
        metaobject {
          id
          handle
          type
        }
        userErrors { field message }
      }
    }
  `;

  const metaobjectInput = {
    type: BUNDLE_METAOBJECT_TYPE,
    fields: [
      { key: "name", value: name },
      { key: "products", value: JSON.stringify(productIds) },
      { key: "discount_type", value: discount_type },
      { key: "discount_value", value: discount_value },
      { key: "status", value: status },
    ],
  };

  const res = await admin.graphql(mutation, { variables: { metaobject: metaobjectInput } });
  const json = await res.json();

  if ((json as any).errors) {
    return { errors: { server: "GraphQL errors occurred" } } as ActionData;
  }

  const userErrors = json.data?.metaobjectCreate?.userErrors ?? [];
  if (userErrors.length > 0) {
    // convert to field errors if possible
    const fieldErrors: Record<string, string> = {};
    for (const e of userErrors) {
      const key = (e.field && e.field[0]) || "server";
      fieldErrors[key] = e.message;
    }
    return { errors: fieldErrors } as ActionData;
  }

  // success — redirect to bundle list
  return redirect("/bundle-discounts");
};

export default function CreateBundlePage() {
  const actionData = useActionData() as ActionData | undefined;

  return (
    <s-page heading="Create Bundle">
      <s-section>
        <Form method="post">
          <s-text-field name="name" label="Bundle Name" error={actionData?.errors?.name}></s-text-field>

          <s-text-field
            name="products"
            label="Product IDs (comma-separated)"
            details="Provide product GIDs or IDs separated by commas"
            error={actionData?.errors?.products}
          />

          <s-text-field name="discount_type" label="Discount Type" placeholder="percentage or fixed" />

          <s-text-field name="discount_value" label="Discount Value" />

          <s-select name="status" label="Status">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </s-select>

          {actionData?.errors?.server && <s-paragraph>{actionData.errors.server}</s-paragraph>}

          <s-button type="submit" slot="primary-action">Save Bundle</s-button>
        </Form>
      </s-section>
    </s-page>
  );
}
