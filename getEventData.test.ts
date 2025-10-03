import { getEventData } from "../actions/getEventData"; // adjust path if needed
import { supabase } from "@/lib/supabaseClient";
import { getTicketPriceForEvent } from "../actions/ticketPricing";

// Mock Supabase client fully
jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn(),
    storage: {
      from: jest.fn(),
    },
  },
}));


jest.mock('react', () => {
  const actualReact = jest.requireActual('react');
  return {
    ...actualReact,
    cache: (fn: any) => fn,
  };
});


// Mock ticketPricing
jest.mock("../actions/ticketPricing", () => ({
  getTicketPriceForEvent: jest.fn(),
}));

describe("getEventData", () => {
  const eventId = "test-event-id";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns event data successfully", async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: eventId,
          title: "Test Event",
          date: "2025-07-30",
          start_time: "10:00",
          end_time: "12:00",
          description: "Desc",
          is_paid: true,
          status: "active",
          location: { street_address: "123 St", latitude: 1, longitude: 2 },
          remaining: 5,
          organisations: { name: "Org" },
        },
        error: null,
      }),
    });

    (getTicketPriceForEvent as jest.Mock).mockResolvedValue({
      price: 20,
      ticketTypeName: "VIP",
      ticketTypeId: "vip123",
    });

    (supabase.storage.from as jest.Mock).mockReturnValue({
      list: jest.fn().mockResolvedValue({
        data: [
          { name: "image1.jpg" },
          { name: "banner.jpg" },
          { name: "image2.png" },
        ],
        error: null,
      }),
    });

    const result = await getEventData(eventId);

    expect(result.success).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event).toMatchObject({
      id: eventId,
      title: "Test Event",
      price: 20,
      ticketTypeName: "VIP",
      ticketTypeId: "vip123",
      limit: 5,
      images: ["image1.jpg", "image2.png"], 
    });
    expect(result.event!.remaining).toBeUndefined();
  });

  it("returns failure on supabase event fetch error", async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "db error" },
      }),
    });

    const result = await getEventData(eventId);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Failed to fetch event details");
  });

  it("logs error but returns success when image list fetch fails", async () => {
    (supabase.from as jest.Mock).mockReturnValueOnce({
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({
        data: {
          id: eventId,
          title: "Test Event",
          date: "2025-07-30",
          start_time: "10:00",
          end_time: "12:00",
          description: "Desc",
          is_paid: true,
          status: "active",
          location: { street_address: "123 St", latitude: 1, longitude: 2 },
          remaining: 15,
          organisations: { name: "Org" },
        },
        error: null,
      }),
    });

    (getTicketPriceForEvent as jest.Mock).mockResolvedValue({
      price: 20,
      ticketTypeName: "VIP",
      ticketTypeId: "vip123",
    });

    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

    (supabase.storage.from as jest.Mock).mockReturnValue({
      list: jest.fn().mockResolvedValue({
        data: null,
        error: { message: "storage error" },
      }),
    });

    const result = await getEventData(eventId);

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[getEventData] Error while fetching images: ",
      { message: "storage error" }
    );

    expect(result.success).toBe(true);
    expect(result.event).toBeDefined();
    expect(result.event!.limit).toBe(10); // because remaining > 10

    consoleErrorSpy.mockRestore();
  });

  it("handles unexpected errors gracefully", async () => {
    (supabase.from as jest.Mock).mockImplementation(() => {
      throw new Error("Unexpected!");
    });

    const result = await getEventData(eventId);

    expect(result.success).toBe(false);
    expect(result.message).toBe(
      "An unexpected error occurred while fetching the event details"
    );
  });
});