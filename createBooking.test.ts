import { createBooking, createBookingAfterPayment } from "../actions/createBooking";
import { supabase } from "@/lib/supabaseClient";
import QRCode from "qrcode";
import { sendEmail } from "../email";
import { checkUser } from "../data/checkUser";
import { createUser } from "../actions/createUser";
import fetchMock from "jest-fetch-mock";

fetchMock.enableMocks();

// Fixed schema().from() mock chain
const mockSchemaSelect = {
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
};

const mockSchemaFrom = {
  update: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  select: jest.fn(() => mockSchemaSelect), // fixed to allow select().eq()
};

// Regular supabase.from() mock
const mockFrom = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: { id: "user123" }, error: null }),
};

jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    schema: jest.fn(() => ({
      from: jest.fn(() => mockSchemaFrom),
    })),
    from: jest.fn(() => mockFrom),
  },
}));

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-qr-code")),
}));

jest.mock("../email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("../data/checkUser", () => ({
  checkUser: jest.fn().mockResolvedValue({ id: "user123" }),
}));

jest.mock("../actions/createUser", () => ({
  createUser: jest.fn().mockResolvedValue({ success: true, userId: "user123" }),
}));

beforeEach(() => {
  fetchMock.resetMocks();
  process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";
});

describe("createBooking", () => {
  it("returns payment URL on valid paid booking", async () => {
    const formData = new FormData();
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("phoneNumber", "01700000000");
    formData.set("email", "john@example.com");
    formData.set("age", "30");
    formData.set("profession", "1");
    formData.set("gender", "true");
    formData.set("couponDiscount", "100");
    formData.set("couponId", "ANU1000");
    formData.set(
      "bookings",
      JSON.stringify([
        {
          date: "25/03/2025",
          d_selection: true,
          s_count: 1,
          i_count: 1,
        },
      ])
    );

    fetchMock.mockResponseOnce(JSON.stringify({ url: "https://payment.url" }), {
      status: 200,
    });

    const result = await createBooking(formData);
    console.log("createBooking result:", result);

    expect(result.success).toBe(true);
    expect(result.paymentUrl).toContain("payment.url");
  });
});

describe("createBookingAfterPayment", () => {
  it("confirms booking and sends email", async () => {
    const bookingData = {
      email: "john@example.com",
      transactionId: "txn123",
      bookingIds: ["booking1"],
    };

    (mockFrom.select as jest.Mock).mockReturnThis();
    (mockFrom.eq as jest.Mock).mockReturnThis();
    (mockFrom.single as jest.Mock).mockResolvedValueOnce({
      data: {
        user_id: "user123",
        product_metadata: { bookingIds: ["booking1"] },
        amount: 1000,
      },
      error: null,
    });

    (mockFrom.single as jest.Mock).mockResolvedValueOnce({
      data: {
        first_name: "John",
      },
      error: null,
    });

    const result = await createBookingAfterPayment(bookingData);

    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Booking confirmed/);
    expect(sendEmail).toHaveBeenCalled();
  });
});