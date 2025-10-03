import { createUser } from "../actions/createUser";
import { supabase } from "@/lib/supabaseClient";
import { validateBDPhoneNumber } from "../utils";

// Mock validateBDPhoneNumber utility
jest.mock("../utils", () => ({
  validateBDPhoneNumber: jest.fn(),
}));


jest.mock("@/lib/supabaseClient", () => {
  return {
    supabase: {
      from: jest.fn(),
    },
  };
});

describe("createUser", () => {
  const mockFrom = supabase.from as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fail if phone number is invalid", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: false });

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "invalid-phone",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid Phone Number",
    });
    expect(validateBDPhoneNumber).toHaveBeenCalledWith("invalid-phone");
  });

  it("should fail if email is invalid", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: true });

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "invalid-email",
      phone: "01712345678",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result).toEqual({
      success: false,
      error: "Invalid Email",
    });
  });

  it("should fail if supabase returns error checking existing email", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: true });

    // First call: no user by email (for .maybeSingle)
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: new Error("DB error") }),
        }),
      }),
    }));

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "01712345678",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to check existing user");
  });

  it("should fail if user with email already exists", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: true });

    // Mock supabase.from for email existence check returning a user
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: "existing-id" }, error: null }),
        }),
      }),
    }));

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "01712345678",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result).toEqual({
      success: false,
      error: "A user with the same email already exists",
    });
  });

  it("should create user successfully", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: true });

    // Mock supabase.from for email existence check (no user found)
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    // Mock supabase.from for user insert
    mockFrom.mockImplementationOnce(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: { id: "new-user-id" }, error: null }),
    }));

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "01712345678",
      ig_handle: "@john",
      profession: 1,
      age: 30,
      gender: true,
    });

    expect(result).toEqual({
      success: true,
      userId: "new-user-id",
    });
  });

  it("should fail if error occurs during user creation", async () => {
    (validateBDPhoneNumber as jest.Mock).mockReturnValue({ valid: true });

    // Mock supabase.from for email existence check (no user found)
    mockFrom.mockImplementationOnce(() => ({
      select: () => ({
        eq: () => ({
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }));

    // Mock supabase.from for insert with error
    mockFrom.mockImplementationOnce(() => ({
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: new Error("Insert failed") }),
    }));

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "01712345678",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to create user");
  });

  it("should catch unexpected errors", async () => {
    (validateBDPhoneNumber as jest.Mock).mockImplementation(() => {
      throw new Error("Unexpected");
    });

    const result = await createUser({
      first_name: "John",
      last_name: "Doe",
      email: "john@example.com",
      phone: "01712345678",
      ig_handle: null,
      profession: null,
      age: null,
      gender: null,
    });

    expect(result).toEqual({
      success: false,
      error: "Failed to create user due to an unexpected error.",
    });
  });
});