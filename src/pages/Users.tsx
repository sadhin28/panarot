
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import {
  Users as UsersIcon,
  UserPlus,
  Search,
  RefreshCw,
  Edit3,
  Trash2,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  Loader2,
  Phone,
  Mail,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  User,
} from "lucide-react";

import { supabase } from "../lib/supabase";

type UserRole = "admin" | "employee";

type Profile = {
  id: string;
  full_name: string;
  phone: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

type UserForm = {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  role: UserRole;
};

type FilterType = "all" | "active" | "inactive" | "admin" | "employee";

const initialForm: UserForm = {
  full_name: "",
  email: "",
  password: "",
  phone: "",
  role: "employee",
};

export default function Users() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [form, setForm] = useState<UserForm>(initialForm);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  // GET CURRENT USER
  const getCurrentUser = useCallback(async () => {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      console.error("Current user error:", error);
      return;
    }

    setCurrentUserId(data.user?.id ?? null);
  }, []);

  // LOAD USERS
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, role, is_active, created_at, updated_at"
        )
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setUsers((data || []) as Profile[]);
    } catch (error) {
      console.error("Users loading error:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "ব্যবহারকারীদের তথ্য লোড করা যায়নি।"
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getCurrentUser();
    fetchUsers();
  }, [getCurrentUser, fetchUsers]);

  // EDGE FUNCTION ERROR HANDLER
  const getFunctionError = async (error: any): Promise<string> => {
    console.error("Edge Function Error:", error);

    let result = error?.message || "Edge Function কাজ করতে পারেনি।";

    try {
      if (error?.context instanceof Response) {
        const response = error.context.clone();
        const text = await response.text();

        console.error("Server Response:", text);

        if (text) {
          try {
            const parsed = JSON.parse(text);
            result =
              parsed.error ||
              parsed.message ||
              parsed.msg ||
              text;
          } catch {
            result = text;
          }
        }
      }
    } catch (parseError) {
      console.error("Error reading server response:", parseError);
    }

    return result;
  };

  // CALL MANAGE USER FUNCTION
  const callManageUser = async (payload: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke(
      "manage-user",
      {
        body: payload,
      }
    );

    if (error) {
      throw new Error(await getFunctionError(error));
    }

    if (data?.error) {
      throw new Error(data.error);
    }

    return data;
  };

  // FILTER USERS
  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const searchText = search.toLowerCase();

      const matchesSearch =
        user.full_name?.toLowerCase().includes(searchText) ||
        user.phone?.toLowerCase().includes(searchText) ||
        user.id?.toLowerCase().includes(searchText);

      let matchesFilter = true;

      if (filter === "active") {
        matchesFilter = user.is_active;
      } else if (filter === "inactive") {
        matchesFilter = !user.is_active;
      } else if (filter === "admin") {
        matchesFilter = user.role === "admin";
      } else if (filter === "employee") {
        matchesFilter = user.role === "employee";
      }

      return matchesSearch && matchesFilter;
    });
  }, [users, search, filter]);

  // STATISTICS
  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.is_active).length;
  const inactiveUsers = users.filter((u) => !u.is_active).length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  // OPEN ADD MODAL
  const openAddModal = () => {
    setEditingUser(null);
    setForm(initialForm);
    setMessage("");
    setErrorMessage("");
    setModalOpen(true);
  };

  // OPEN EDIT MODAL
  const openEditModal = (user: Profile) => {
    setEditingUser(user);

    setForm({
      full_name: user.full_name || "",
      email: "",
      password: "",
      phone: user.phone || "",
      role: user.role,
    });

    setMessage("");
    setErrorMessage("");
    setModalOpen(true);
  };

  // CLOSE MODAL
  const closeModal = () => {
    if (saving) return;

    setModalOpen(false);
    setEditingUser(null);
    setForm(initialForm);
    setErrorMessage("");
  };

  // SAVE USER
  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setSaving(true);
    setErrorMessage("");

    try {
      if (!form.full_name.trim()) {
        throw new Error("ব্যবহারকারীর নাম লিখুন।");
      }

      if (editingUser) {
        await callManageUser({
          action: "update",
          user_id: editingUser.id,
          full_name: form.full_name.trim(),
          phone: form.phone.trim(),
          role: form.role,
        });

        setMessage("ব্যবহারকারীর তথ্য সফলভাবে আপডেট হয়েছে।");
      } else {
        if (!form.email.trim()) {
          throw new Error("Email Address লিখুন।");
        }

        if (!form.password || form.password.length < 6) {
          throw new Error("Password কমপক্ষে ৬ অক্ষরের হতে হবে।");
        }

        await callManageUser({
          action: "create",
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          password: form.password,
          phone: form.phone.trim(),
          role: form.role,
        });

        setMessage("নতুন ব্যবহারকারী সফলভাবে তৈরি হয়েছে।");
      }

      setModalOpen(false);
      setEditingUser(null);
      setForm(initialForm);

      await fetchUsers();

      window.alert(
        editingUser
          ? "ব্যবহারকারীর তথ্য আপডেট হয়েছে।"
          : "নতুন User সফলভাবে তৈরি হয়েছে।"
      );
    } catch (error) {
      console.error("Save user error:", error);

      const errorText =
        error instanceof Error
          ? error.message
          : "কাজটি সম্পন্ন করা যায়নি।";

      setErrorMessage(errorText);
      window.alert(errorText);
    } finally {
      setSaving(false);
    }
  };

  // CHANGE ACTIVE STATUS
  const toggleStatus = async (user: Profile) => {
    if (user.id === currentUserId) {
      window.alert("নিজের Account Inactive করতে পারবেন না।");
      return;
    }

    const newStatus = !user.is_active;

    const confirmed = window.confirm(
      newStatus
        ? `${user.full_name}-কে Active করতে চান?`
        : `${user.full_name}-কে Inactive করতে চান?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      await callManageUser({
        action: "update",
        user_id: user.id,
        full_name: user.full_name,
        phone: user.phone || "",
        role: user.role,
        is_active: newStatus,
      });

      await fetchUsers();

      window.alert(
        newStatus
          ? "User Active করা হয়েছে।"
          : "User Inactive করা হয়েছে।"
      );
    } catch (error) {
      console.error("Status update error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "Status পরিবর্তন করা যায়নি।"
      );

      setLoading(false);
    }
  };

  // DELETE USER
  const deleteUser = async (user: Profile) => {
    if (user.id === currentUserId) {
      window.alert("নিজের Account Delete করতে পারবেন না।");
      return;
    }

    const confirmed = window.confirm(
      `আপনি কি নিশ্চিত যে "${user.full_name}"-কে সম্পূর্ণ Delete করতে চান?\n\nএই কাজটি Undo করা যাবে না।`
    );

    if (!confirmed) return;

    try {
      setLoading(true);

      await callManageUser({
        action: "delete",
        user_id: user.id,
      });

      await fetchUsers();

      window.alert("User সফলভাবে Delete হয়েছে।");
    } catch (error) {
      console.error("Delete user error:", error);

      window.alert(
        error instanceof Error
          ? error.message
          : "User Delete করা যায়নি।"
      );

      setLoading(false);
    }
  };

  // DATE FORMAT
  const formatDate = (date: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // INPUT HANDLER
  const handleInputChange = (
    field: keyof UserForm,
    value: string
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // UI
  return (
    <div className="min-h-screen space-y-6 bg-gray-50 p-4 text-gray-800 dark:bg-gray-950 dark:text-gray-100 sm:p-6">
      {/* HEADER */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400">
              <UsersIcon size={25} />
            </div>

            <div>
              <h1 className="text-2xl font-bold">User Management</h1>

              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Manage account, roles and access permissions
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
          >
            <RefreshCw
              size={17}
              className={loading ? "animate-spin" : ""}
            />
            Refresh
          </button>

          <button
            onClick={openAddModal}
            className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-green-700/20 transition hover:bg-green-800"
          >
            <UserPlus size={18} />
            Add New User
          </button>
        </div>
      </div>

      {/* ERROR MESSAGE */}
      {errorMessage && !modalOpen && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle size={20} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Error</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* STATISTICS */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          icon={<UsersIcon size={22} />}
          color="blue"
        />

        <StatCard
          title="Active Users"
          value={activeUsers}
          icon={<UserCheck size={22} />}
          color="green"
        />

        <StatCard
          title="Inactive Users"
          value={inactiveUsers}
          icon={<UserX size={22} />}
          color="red"
        />

        <StatCard
          title="Administrators"
          value={adminUsers}
          icon={<ShieldCheck size={22} />}
          color="purple"
        />
      </div>

      {/* USER TABLE SECTION */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {/* SEARCH AND FILTER */}
        <div className="flex flex-col gap-4 border-b border-gray-200 p-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold">All Users</h2>

            <p className="text-sm text-gray-500 dark:text-gray-400">
              Manage all registered users
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative">
              <Search
                size={18}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search name, phone..."
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-gray-700 dark:bg-gray-800 sm:w-64"
              />
            </div>

            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as FilterType)
              }
              className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none focus:border-green-600 dark:border-gray-700 dark:bg-gray-800"
            >
              <option value="all">All Users</option>
              <option value="active">Active Users</option>
              <option value="inactive">Inactive Users</option>
              <option value="admin">Administrators</option>
              <option value="employee">Employees</option>
            </select>
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3">
            <Loader2
              size={32}
              className="animate-spin text-green-600"
            />

            <p className="text-sm text-gray-500">Loading users...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="flex min-h-64 flex-col items-center justify-center px-4 text-center">
            <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800">
              <UsersIcon size={30} />
            </div>

            <h3 className="font-semibold">No Users Found</h3>

            <p className="mt-1 text-sm text-gray-500">
              No users match your search or filter.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800/70 dark:text-gray-400">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Phone</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Created</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredUsers.map((user) => {
                    const isCurrentUser =
                      user.id === currentUserId;

                    return (
                      <tr
                        key={user.id}
                        className="transition hover:bg-gray-50 dark:hover:bg-gray-800/40"
                      >
                        {/* USER */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-100 font-bold text-green-700 dark:bg-green-900/40 dark:text-green-400">
                              {user.full_name
                                ?.charAt(0)
                                ?.toUpperCase() || "U"}
                            </div>

                            <div>
                              <p className="font-semibold">
                                {user.full_name}

                                {isCurrentUser && (
                                  <span className="ml-2 text-xs font-medium text-green-600">
                                    You
                                  </span>
                                )}
                              </p>

                              <p className="mt-1 max-w-40 truncate text-xs text-gray-400">
                                {user.id}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* PHONE */}
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-300">
                            <Phone size={15} className="text-gray-400" />
                            {user.phone || "Not provided"}
                          </div>
                        </td>

                        {/* ROLE */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              user.role === "admin"
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                                : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                            }`}
                          >
                            {user.role === "admin" ? (
                              <ShieldCheck size={14} />
                            ) : (
                              <User size={14} />
                            )}

                            {user.role === "admin" ? "Admin" : "Employee"}
                          </span>
                        </td>

                        {/* STATUS */}
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
                              user.is_active
                                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                            }`}
                          >
                            {user.is_active ? (
                              <CheckCircle2 size={14} />
                            ) : (
                              <AlertCircle size={14} />
                            )}

                            {user.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>

                        {/* DATE */}
                        <td className="px-6 py-4 text-gray-500 dark:text-gray-400">
                          {formatDate(user.created_at)}
                        </td>

                        {/* ACTIONS */}
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(user)}
                              title="Edit User"
                              className="rounded-lg border border-gray-200 p-2 text-blue-600 transition hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-blue-900/20"
                            >
                              <Edit3 size={16} />
                            </button>

                            <button
                              onClick={() => toggleStatus(user)}
                              disabled={isCurrentUser}
                              title={
                                user.is_active
                                  ? "Deactivate User"
                                  : "Activate User"
                              }
                              className={`rounded-lg border border-gray-200 p-2 transition disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 ${
                                user.is_active
                                  ? "text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                                  : "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                              }`}
                            >
                              {user.is_active ? (
                                <UserX size={16} />
                              ) : (
                                <UserCheck size={16} />
                              )}
                            </button>

                            <button
                              onClick={() => deleteUser(user)}
                              disabled={isCurrentUser}
                              title="Delete User"
                              className="rounded-lg border border-gray-200 p-2 text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-gray-700 dark:hover:bg-red-900/20"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* TABLE FOOTER */}
            <div className="border-t border-gray-200 px-6 py-4 text-sm text-gray-500 dark:border-gray-800">
              Showing{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {filteredUsers.length}
              </span>{" "}
              of{" "}
              <span className="font-semibold text-gray-800 dark:text-gray-200">
                {totalUsers}
              </span>{" "}
              users
            </div>
          </>
        )}
      </div>

      {/* ADD / EDIT MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm">
          <div className="my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-900">
            {/* MODAL HEADER */}
            <div className="flex items-center justify-between bg-green-800 px-6 py-5 text-white">
              <div>
                <h2 className="text-xl font-bold">
                  {editingUser ? "Edit User" : "Add New User"}
                </h2>

                <p className="mt-1 text-sm text-green-100">
                  {editingUser
                    ? "Update user information and permissions"
                    : "Create a new account for your business"}
                </p>
              </div>

              <button
                onClick={closeModal}
                disabled={saving}
                className="rounded-lg p-2 transition hover:bg-white/10"
              >
                <X size={22} />
              </button>
            </div>

            {/* MODAL BODY */}
            <form
              onSubmit={handleSubmit}
              className="space-y-5 p-6"
            >
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* FULL NAME */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Full Name <span className="text-red-500">*</span>
                </label>

                <div className="relative">
                  <User
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="text"
                    required
                    value={form.full_name}
                    onChange={(e) =>
                      handleInputChange("full_name", e.target.value)
                    }
                    placeholder="Enter full name"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
              </div>

              {/* EMAIL */}
              {!editingUser && (
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Email Address <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <Mail
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="email"
                      required
                      value={form.email}
                      onChange={(e) =>
                        handleInputChange("email", e.target.value)
                      }
                      placeholder="example@email.com"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </div>
                </div>
              )}

              {/* PASSWORD */}
              {!editingUser && (
                <div>
                  <label className="mb-2 block text-sm font-semibold">
                    Password <span className="text-red-500">*</span>
                  </label>

                  <div className="relative">
                    <KeyRound
                      size={18}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                    />

                    <input
                      type="password"
                      required
                      minLength={6}
                      value={form.password}
                      onChange={(e) =>
                        handleInputChange("password", e.target.value)
                      }
                      placeholder="Minimum 6 characters"
                      className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-gray-700 dark:bg-gray-800"
                    />
                  </div>
                </div>
              )}

              {/* PHONE */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  Phone Number
                </label>

                <div className="relative">
                  <Phone
                    size={18}
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  />

                  <input
                    type="tel"
                    value={form.phone}
                    onChange={(e) =>
                      handleInputChange("phone", e.target.value)
                    }
                    placeholder="01XXXXXXXXX"
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-green-600 focus:ring-2 focus:ring-green-600/10 dark:border-gray-700 dark:bg-gray-800"
                  />
                </div>
              </div>

              {/* ROLE */}
              <div>
                <label className="mb-2 block text-sm font-semibold">
                  User Role <span className="text-red-500">*</span>
                </label>

                <select
                  value={form.role}
                  onChange={(e) =>
                    handleInputChange("role", e.target.value)
                  }
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm outline-none transition focus:border-green-600 dark:border-gray-700 dark:bg-gray-800"
                >
                  <option value="employee">Employee</option>
                  <option value="admin">Admin</option>
                </select>

                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Admin can manage the system. Employee access depends on
                  your application's permissions.
                </p>
              </div>

              {/* BUTTONS */}
              <div className="flex flex-col-reverse gap-3 border-t border-gray-100 pt-5 dark:border-gray-800 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 rounded-xl bg-green-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      {editingUser ? (
                        <CheckCircle2 size={18} />
                      ) : (
                        <UserPlus size={18} />
                      )}

                      {editingUser ? "Update User" : "Create User"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// STATISTICS CARD
function StatCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "red" | "purple";
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    green: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    red: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
    purple: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">
            {title}
          </p>

          <h3 className="mt-2 text-3xl font-bold">
            {value}
          </h3>
        </div>

        <div
          className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}
