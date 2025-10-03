import { getTicketPriceForEvent } from "../actions/ticketPricing";
import { supabase } from "@/lib/supabaseClient";

jest.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSingle = jest.fn();

const mockQueryBuilder = {
  eq: jest.fn(),
  lte: jest.fn(),
  gte: jest.fn(),
  single: mockSingle,
  
};

describe("getTicketPriceForEvent", () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    
    mockQueryBuilder.eq.mockImplementation(() => mockQueryBuilder);
    mockQueryBuilder.lte.mockImplementation(() => mockQueryBuilder);
    mockQueryBuilder.gte.mockImplementation(() => mockQueryBuilder);
    mockQueryBuilder.single.mockImplementation(() => Promise.resolve({ data: null, error: null }));

    mockFrom.mockReturnValue({
      select: jest.fn(() => mockQueryBuilder),
    });
  });

  it("returns ticket price and type when ticketTypeId is provided", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        price: 100,
        ticket_types: {
          id: 1,
          name: "VIP",
        },
      },
      error: null,
    });

    const result = await getTicketPriceForEvent("event123", 1);

    expect(result).toEqual({
      success: true,
      price: 100,
      ticketTypeName: "VIP",
      ticketTypeId: 1,
    });
  });

  it("returns ticket price and type based on date if ticketTypeId not provided", async () => {
    mockSingle.mockResolvedValueOnce({
      data: {
        price: 50,
        ticket_types: {
          id: 2,
          name: "General",
        },
      },
      error: null,
    });

    const result = await getTicketPriceForEvent("event456");

    expect(result).toEqual({
      success: true,
      price: 50,
      ticketTypeName: "General",
      ticketTypeId: 2,
    });
  });

  it("returns error if Supabase query returns error", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "Something went wrong" },
    });

    const result = await getTicketPriceForEvent("event789", 3);

    expect(result).toEqual({
      success: false,
      message: "Something went wrong",
    });
  });

  it("returns error if no data is returned", async () => {
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await getTicketPriceForEvent("event101");

    expect(result).toEqual({
      success: false,
      message: "No ticket type available for registration at this time",
    });
  });

  it("catches and returns unexpected errors", async () => {
    mockSingle.mockRejectedValueOnce(new Error("Unexpected"));

    const result = await getTicketPriceForEvent("event999");

    expect(result).toEqual({
      success: false,
      message: "An unexpected error occurred while checking ticket pricing",
    });
  });
});

