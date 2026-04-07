import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().min(1, { error: "Group name is required" }).max(100),
});

export const updateGroupSchema = z.object({
  name: z.string().min(1, { error: "Group name is required" }).max(100),
});

export const inviteMemberSchema = z.object({
  email: z.email({ error: "A valid email is required" }),
});

export const updateMemberStatusSchema = z.object({
  status: z.enum(["ACCEPTED", "REJECTED"]),
});

export type CreateGroupInput = z.infer<typeof createGroupSchema>;
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>;
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberStatusInput = z.infer<typeof updateMemberStatusSchema>;
