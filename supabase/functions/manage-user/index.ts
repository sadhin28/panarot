
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const response = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return response({ error: "Method not allowed" }, 405);
  }

  try {
    // ---------------------------------------
    // ENVIRONMENT VARIABLES
    // ---------------------------------------

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl) {
      throw new Error("SUPABASE_URL secret is missing");
    }

    if (!anonKey) {
      throw new Error(
        "SUPABASE_ANON_KEY or SUPABASE_PUBLISHABLE_KEY secret is missing"
      );
    }

    if (!serviceKey) {
      throw new Error("SUPABASE_SERVICE_ROLE_KEY secret is missing");
    }

    // ---------------------------------------
    // VERIFY AUTHENTICATED USER
    // ---------------------------------------

    const authHeader = req.headers.get("Authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return response({ error: "Authorization token missing" }, 401);
    }

    const token = authHeader.slice(7);

    const authClient = createClient(supabaseUrl, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const {
      data: { user: caller },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !caller) {
      console.error("Authentication error:", authError);
      return response({ error: "Invalid or expired session" }, 401);
    }

    // ---------------------------------------
    // ADMIN CLIENT
    // ---------------------------------------

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    // ---------------------------------------
    // VERIFY ADMIN PERMISSION
    // ---------------------------------------

    const { data: callerProfile, error: profileError } =
      await adminClient
        .from("profiles")
        .select("id, role, is_active")
        .eq("id", caller.id)
        .maybeSingle();

    if (profileError) {
      console.error("Admin profile error:", profileError);
      return response({ error: profileError.message }, 500);
    }

    if (
      !callerProfile ||
      callerProfile.role !== "admin" ||
      callerProfile.is_active !== true
    ) {
      return response({ error: "Active admin permission required" }, 403);
    }

    // ---------------------------------------
    // REQUEST BODY
    // ---------------------------------------

    const body = await req.json();
    const { action } = body;

    const validRoles = ["admin", "employee"];

    // ---------------------------------------
    // ACTIVE ADMIN COUNT
    // ---------------------------------------

    const getActiveAdminCount = async () => {
      const { count, error } = await adminClient
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin")
        .eq("is_active", true);

      if (error) throw error;

      return count ?? 0;
    };

    // =======================================
    // CREATE USER
    // =======================================

    if (action === "create") {
      const {
        full_name,
        email,
        password,
        phone,
        role,
      } = body;

      if (
        typeof full_name !== "string" ||
        !full_name.trim() ||
        typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string"
      ) {
        return response(
          { error: "Name, email and password are required" },
          400
        );
      }

      if (password.length < 6) {
        return response(
          { error: "Password must be at least 6 characters" },
          400
        );
      }

      if (!validRoles.includes(role)) {
        return response({ error: "Invalid user role" }, 400);
      }

      // Create Auth user
      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email: email.trim().toLowerCase(),
          password,
          email_confirm: true,
          user_metadata: {
            full_name: full_name.trim(),
          },
        });

      if (createError || !created.user) {
        console.error("Auth user creation error:", createError);

        return response(
          { error: createError?.message || "User creation failed" },
          400
        );
      }

      // Upsert prevents duplicate profile errors
      // if a database trigger already created this profile.
      const { error: insertError } = await adminClient
        .from("profiles")
        .upsert(
          {
            id: created.user.id,
            full_name: full_name.trim(),
            phone:
              typeof phone === "string" && phone.trim()
                ? phone.trim()
                : null,
            role,
            is_active: true,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

      if (insertError) {
        console.error("Profile upsert error:", insertError);

        // Roll back Auth user if profile creation fails
        const { error: rollbackError } =
          await adminClient.auth.admin.deleteUser(created.user.id);

        if (rollbackError) {
          console.error("Auth rollback error:", rollbackError);
        }

        return response({ error: insertError.message }, 400);
      }

      return response({
        success: true,
        message: "User created successfully",
        user_id: created.user.id,
      });
    }

    // =======================================
    // UPDATE USER
    // =======================================

    if (action === "update") {
      const { user_id, role, is_active, full_name, phone } = body;

      if (typeof user_id !== "string" || !user_id) {
        return response({ error: "User ID is required" }, 400);
      }

      if (
        role !== undefined &&
        !validRoles.includes(role)
      ) {
        return response({ error: "Invalid user role" }, 400);
      }

      if (
        is_active !== undefined &&
        typeof is_active !== "boolean"
      ) {
        return response({ error: "Invalid active status" }, 400);
      }

      if (
        full_name !== undefined &&
        (typeof full_name !== "string" || !full_name.trim())
      ) {
        return response({ error: "Invalid full name" }, 400);
      }

      if (user_id === caller.id && is_active === false) {
        return response(
          { error: "You cannot deactivate your own account" },
          400
        );
      }

      const { data: target, error: targetError } =
        await adminClient
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", user_id)
          .maybeSingle();

      if (targetError) {
        return response({ error: targetError.message }, 500);
      }

      if (!target) {
        return response({ error: "User not found" }, 404);
      }

      const willRemoveAdmin =
        target.role === "admin" &&
        target.is_active &&
        (role === "employee" || is_active === false);

      if (
        willRemoveAdmin &&
        (await getActiveAdminCount()) <= 1
      ) {
        return response(
          { error: "At least one active admin must remain" },
          400
        );
      }

      const updates: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (role !== undefined) updates.role = role;
      if (is_active !== undefined) updates.is_active = is_active;
      if (full_name !== undefined) updates.full_name = full_name.trim();

      if (phone !== undefined) {
        updates.phone =
          typeof phone === "string" && phone.trim()
            ? phone.trim()
            : null;
      }

      const { error: updateError } = await adminClient
        .from("profiles")
        .update(updates)
        .eq("id", user_id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        return response({ error: updateError.message }, 400);
      }

      return response({
        success: true,
        message: "User updated successfully",
      });
    }

    // =======================================
    // DELETE USER
    // =======================================

    if (action === "delete") {
      const { user_id } = body;

      if (typeof user_id !== "string" || !user_id) {
        return response({ error: "User ID is required" }, 400);
      }

      if (user_id === caller.id) {
        return response(
          { error: "You cannot delete your own account" },
          400
        );
      }

      const { data: target, error: targetError } =
        await adminClient
          .from("profiles")
          .select("id, role, is_active")
          .eq("id", user_id)
          .maybeSingle();

      if (targetError) {
        return response({ error: targetError.message }, 500);
      }

      if (!target) {
        return response({ error: "User not found" }, 404);
      }

      if (
        target.role === "admin" &&
        target.is_active &&
        (await getActiveAdminCount()) <= 1
      ) {
        return response(
          { error: "Cannot delete the last active admin" },
          400
        );
      }

      // Delete Auth account
      const { error: deleteAuthError } =
        await adminClient.auth.admin.deleteUser(user_id);

      if (deleteAuthError) {
        console.error("Auth deletion error:", deleteAuthError);
        return response({ error: deleteAuthError.message }, 400);
      }

      // Remove profile if it still exists
      const { error: deleteProfileError } = await adminClient
        .from("profiles")
        .delete()
        .eq("id", user_id);

      if (deleteProfileError) {
        console.error("Profile cleanup error:", deleteProfileError);

        return response({
          success: true,
          warning:
            "Auth user deleted, but profile cleanup needs attention",
        });
      }

      return response({
        success: true,
        message: "User deleted successfully",
      });
    }

    return response({ error: "Unknown action" }, 400);

  } catch (error) {
    console.error("MANAGE USER FUNCTION ERROR:", error);

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unexpected server error",
      },
      500
    );
  }
});
