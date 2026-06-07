import type { LoaderFunctionArgs } from "react-router";
import { useFetcher } from "react-router";
import { useEffect } from "react";

type BundleRow = {
  id: string;
  name: string;
  products: string[];
  discount: string;
  status: string;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  // no server data required for mock UI
  return null;
};

const MOCK_BUNDLES: BundleRow[] = [
  {
    id: "1",
    name: "Summer Essentials",
    products: ["T-Shirt", "Shorts", "Sunglasses"],
    discount: "15%",
    status: "active",
  },
  {
    id: "2",
    name: "Winter Warmers",
    products: ["Jacket", "Boots"],
    discount: "$25",
    status: "inactive",
  },
];

export default function BundleDiscounts() {
  const fetcher = useFetcher();

  useEffect(() => {
    // placeholder for future fetcher usage
  }, [fetcher.state]);

  return (
    <s-page heading="Bundle Discounts">
      <s-button slot="primary-action">Create Bundle</s-button>

      <s-section>
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
            {MOCK_BUNDLES.map((b) => (
              <tr key={b.id}>
                <td>{b.name}</td>
                <td>{b.products.join(", ")}</td>
                <td>{b.discount}</td>
                <td>{b.status}</td>
                <td>
                  <s-stack direction="inline" gap="base">
                    <s-button variant="tertiary">Edit</s-button>
                    <s-button variant="tertiary">Delete</s-button>
                  </s-stack>
                </td>
              </tr>
            ))}
          </tbody>
        </s-table>
      </s-section>
    </s-page>
  );
}
