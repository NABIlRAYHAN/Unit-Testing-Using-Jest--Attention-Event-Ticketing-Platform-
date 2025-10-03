import { createDayPass } from "../actions/subscriptions";
import { supabase } from "../supabaseClient";

// --- Mock supabaseClient ---
jest.mock("../supabaseClient", () => {
  // Deep chain mocks for schema("ramadan").from("bookings").select(...).in(...).eq(...)
  const eqMock = jest.fn();
  const inMock = jest.fn(() => ({ eq: eqMock }));
  const selectMock = jest.fn(() => ({ in: inMock }));

  const fromSchemaMock = jest.fn(() => ({
    select: selectMock,
  }));

  const schemaMock = jest.fn(() => ({
    from: fromSchemaMock,
  }));

  // For supabase.from("subscriptions").insert([...]).select()
  const insertSelectMock = jest.fn();
  const insertMock = jest.fn(() => ({
    select: insertSelectMock,
  }));

  const fromMock = jest.fn((table) => {
    if (table === "subscriptions") {
      return { insert: insertMock };
    }
    return {};
  });

  return {
    supabase: {
      schema: schemaMock,
      from: fromMock,
    },
  };
});
describe("createDayPass", () => {
  const userId = "user123";
  const bookingIds = ["b1", "b2"];
  const mockBookings = [
    { booking_date: "2025-07-01" },
    { booking_date: "2025-07-02" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns inserted subscriptions successfully", async () => {
    const { supabase } = require("../supabaseClient");

    // Mock return value for bookings select
    supabase.schema().from().select.mockReturnValueOnce({
      in: () => ({
        eq: () => ({
          select: jest.fn().mockResolvedValueOnce({
            data: mockBookings,
            error: null,
          }),
        }),
      }),
    });

    // Mock return value for subscriptions insert
    supabase.from("subscriptions").insert.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce({
        data: [{ id: 1 }, { id: 2 }],
        error: null,
      }),
    });

    const result = await createDayPass(userId, bookingIds);
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it("returns error if no day pass bookings found", async () => {
    const { supabase } = require("../supabaseClient");

    supabase.schema().from().select.mockReturnValueOnce({
      in: () => ({
        eq: () => ({
          select: jest.fn().mockResolvedValueOnce({
            data: [],
            error: null,
          }),
        }),
      }),
    });

    const result = await createDayPass(userId, bookingIds);
    expect(result).toEqual({ error: "No day pass bookings found" });
  });

  it("throws error when fetching bookings fails", async () => {
    const { supabase } = require("../supabaseClient");

    supabase.schema().from().select.mockReturnValueOnce({
      in: () => ({
        eq: () => ({
          select: jest.fn().mockResolvedValueOnce({
            data: null,
            error: new Error("Fetch failed"),
          }),
        }),
      }),
    });

    await expect(createDayPass(userId, bookingIds)).rejects.toThrow("Fetch failed");
  });

  it("throws error when inserting subscriptions fails", async () => {
    const { supabase } = require("../supabaseClient");

    supabase.schema().from().select.mockReturnValueOnce({
      in: () => ({
        eq: () => ({
          select: jest.fn().mockResolvedValueOnce({
            data: mockBookings,
            error: null,
          }),
        }),
      }),
    });

    supabase.from("subscriptions").insert.mockReturnValueOnce({
      select: jest.fn().mockResolvedValueOnce({
        data: null,
        error: new Error("Insert failed"),
      }),
    });

    await expect(createDayPass(userId, bookingIds)).rejects.toThrow("Insert failed");
  });
});
