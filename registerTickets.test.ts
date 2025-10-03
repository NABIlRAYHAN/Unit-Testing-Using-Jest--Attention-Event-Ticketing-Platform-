
import { registerTicket, createTicketAfterPayment, getSecureEventHash } from "../actions/registerTickets";
// import { supabase } from "../supabaseClient"
import {supabase} from "@/lib/supabaseClient"
import QRCode from "qrcode";
import { sendEmail } from "../email";
import { checkUser } from "../data/checkUser";
import { createUser } from "../actions/createUser";
import { getTicketPriceForEvent } from "../actions/ticketPricing";
import fetchMock from 'jest-fetch-mock';
 

// Mock dependencies
jest.mock("../supabaseClient", () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "user123" }, error: null }),
    })),
  },
}));

jest.mock("qrcode", () => ({
  toBuffer: jest.fn().mockResolvedValue(Buffer.from("mock-qrcode")),
}));

jest.mock("../email", () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock("..//data/checkUser", () => ({
  checkUser: jest.fn().mockResolvedValue({ id: "user123" }),
}));

jest.mock("../actions/createUser", () => ({
  createUser: jest.fn().mockResolvedValue({ success: true, userId: "user123" }),
}));

jest.mock("../actions/ticketPricing", () => ({
  getTicketPriceForEvent: jest.fn().mockResolvedValue({ price: 500, ticketTypeId: 2 }),
}));

beforeEach(() => {
  fetchMock.resetMocks();
  process.env.HASH_SECRET = "test-secret";
  process.env.NEXT_PUBLIC_BASE_URL = "https://example.com";
});

describe("registerTicket", () => {
  it("returns payment URL for paid event", async () => {
    const ticketPrice = 500;
    const ticketType = 2;
    const eventId = "event123";
    const secureHash = getSecureEventHash(eventId, ticketPrice, ticketType);

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("quantity", "2");
    formData.set("ticketPrice", ticketPrice.toString());
    formData.set("ticketType", ticketType.toString());
    formData.set("secureHash", secureHash);
    formData.set("firstName", "John");
    formData.set("lastName", "Doe");
    formData.set("phoneNumber", "1234567890");
    formData.set("email", "john@example.com");

    fetchMock.mockResponseOnce(
    JSON.stringify({ url: "https://payment.url" }),
    { status: 200 }
  );

    const result = await registerTicket(formData);

    expect(result.success).toBe(true);
    expect(result.paymentUrl).toContain("payment.url");
  });

  it("returns ticket URL for free event", async () => {
    const eventId = "event456";
    const ticketPrice = 0;
    const ticketType = 0;
    const secureHash = getSecureEventHash(eventId, ticketPrice, ticketType);

    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("quantity", "1");
    formData.set("ticketPrice", "0");
    formData.set("ticketType", "0");
    formData.set("secureHash", secureHash);
    formData.set("firstName", "Alice");
    formData.set("lastName", "Smith");
    formData.set("phoneNumber", "9876543210");
    formData.set("email", "alice@example.com");

    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "ticket789",
          users: { first_name: "Alice" },
        },
        error: null,
      }),
    });

    const result = await registerTicket(formData);

    expect(result.success).toBe(true);
    expect(result.ticketUrl).toContain("ticketId=ticket789");
  });
});

describe("createTicketAfterPayment", () => {
  it("creates ticket after payment and sends email", async () => {
    const data = {
      email: "john@example.com",
      eventId: "event123",
      ticketType: 2,
      quantity: 2,
      transactionId: "txn123",
    };

    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: { user_id: "user123" },
        error: null,
      }),
    });

    (supabase.from as jest.Mock).mockReturnValueOnce({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: "ticket999",
          users: { first_name: "John"},
          transactions: { amount: 1000, id: "txn123" },
        },
        error: null,
      }),
    });

    const result = await createTicketAfterPayment(data);

    expect(result.success).toBe(true);
    expect(result.ticket).toBeDefined();
    expect(result.emailSent).toBe(true);
    expect(sendEmail).toHaveBeenCalled();
  });
});