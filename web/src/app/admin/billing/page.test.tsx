import BillingPage from "./page";

const mockRedirect = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}));

describe("BillingPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("redirects billing requests to the theme page", () => {
    BillingPage();

    expect(mockRedirect).toHaveBeenCalledWith("/admin/theme");
  });
});
