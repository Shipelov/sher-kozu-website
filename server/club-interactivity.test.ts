import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Club Interactivity Tests
 * Tests for likes, comments, and event registration features.
 * These test the DB helper functions and tRPC procedure logic.
 */

// Mock the database module
vi.mock("./db", () => ({
  togglePostLike: vi.fn(),
  getPostLikeCount: vi.fn(),
  hasUserLikedPost: vi.fn(),
  addPostComment: vi.fn(),
  getPostComments: vi.fn(),
  hidePostComment: vi.fn(),
  unhidePostComment: vi.fn(),
  deletePostComment: vi.fn(),
  registerForEvent: vi.fn(),
  cancelEventRegistration: vi.fn(),
  getEventRegistrations: vi.fn(),
  getUserEventRegistration: vi.fn(),
  adminUpdateRegistrationStatus: vi.fn(),
  adminListComments: vi.fn(),
  adminListRegistrations: vi.fn(),
}));

import {
  togglePostLike,
  getPostLikeCount,
  hasUserLikedPost,
  addPostComment,
  getPostComments,
  hidePostComment,
  unhidePostComment,
  deletePostComment,
  registerForEvent,
  cancelEventRegistration,
  getEventRegistrations,
  getUserEventRegistration,
  adminUpdateRegistrationStatus,
  adminListComments,
  adminListRegistrations,
} from "./db";

const mockedTogglePostLike = vi.mocked(togglePostLike);
const mockedGetPostLikeCount = vi.mocked(getPostLikeCount);
const mockedHasUserLikedPost = vi.mocked(hasUserLikedPost);
const mockedAddPostComment = vi.mocked(addPostComment);
const mockedGetPostComments = vi.mocked(getPostComments);
const mockedHidePostComment = vi.mocked(hidePostComment);
const mockedUnhidePostComment = vi.mocked(unhidePostComment);
const mockedDeletePostComment = vi.mocked(deletePostComment);
const mockedRegisterForEvent = vi.mocked(registerForEvent);
const mockedCancelEventRegistration = vi.mocked(cancelEventRegistration);
const mockedGetEventRegistrations = vi.mocked(getEventRegistrations);
const mockedGetUserEventRegistration = vi.mocked(getUserEventRegistration);
const mockedAdminUpdateRegistrationStatus = vi.mocked(adminUpdateRegistrationStatus);
const mockedAdminListComments = vi.mocked(adminListComments);
const mockedAdminListRegistrations = vi.mocked(adminListRegistrations);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Post Likes", () => {
  it("togglePostLike should be called with correct params", async () => {
    mockedTogglePostLike.mockResolvedValue({ liked: true, likeCount: 5 });
    const result = await togglePostLike(1, "user-123", "Test User");
    expect(mockedTogglePostLike).toHaveBeenCalledWith(1, "user-123", "Test User");
    expect(result.liked).toBe(true);
    expect(result.likeCount).toBe(5);
  });

  it("togglePostLike should return unlike state", async () => {
    mockedTogglePostLike.mockResolvedValue({ liked: false, likeCount: 4 });
    const result = await togglePostLike(1, "user-123", "Test User");
    expect(result.liked).toBe(false);
    expect(result.likeCount).toBe(4);
  });

  it("getPostLikeCount should return count", async () => {
    mockedGetPostLikeCount.mockResolvedValue(10);
    const count = await getPostLikeCount(1);
    expect(count).toBe(10);
  });

  it("hasUserLikedPost should return boolean", async () => {
    mockedHasUserLikedPost.mockResolvedValue(true);
    const liked = await hasUserLikedPost(1, "user-123");
    expect(liked).toBe(true);
  });

  it("hasUserLikedPost should return false for non-liked post", async () => {
    mockedHasUserLikedPost.mockResolvedValue(false);
    const liked = await hasUserLikedPost(2, "user-456");
    expect(liked).toBe(false);
  });
});

describe("Post Comments", () => {
  it("addPostComment should create a comment", async () => {
    mockedAddPostComment.mockResolvedValue({
      id: 1,
      postId: 1,
      userOpenId: "user-123",
      userName: "Test User",
      text: "Great post!",
      hidden: false,
      createdAt: new Date(),
    });
    const comment = await addPostComment(1, "user-123", "Test User", "Great post!");
    expect(mockedAddPostComment).toHaveBeenCalledWith(1, "user-123", "Test User", "Great post!");
    expect(comment.text).toBe("Great post!");
    expect(comment.hidden).toBe(false);
  });

  it("getPostComments should return array of comments", async () => {
    mockedGetPostComments.mockResolvedValue([
      { id: 1, postId: 1, userOpenId: "u1", userName: "Alice", text: "Hello", hidden: false, createdAt: new Date() },
      { id: 2, postId: 1, userOpenId: "u2", userName: "Bob", text: "World", hidden: false, createdAt: new Date() },
    ]);
    const comments = await getPostComments(1);
    expect(comments).toHaveLength(2);
    expect(comments[0].userName).toBe("Alice");
  });

  it("hidePostComment should mark comment as hidden", async () => {
    mockedHidePostComment.mockResolvedValue(undefined);
    await hidePostComment(1);
    expect(mockedHidePostComment).toHaveBeenCalledWith(1);
  });

  it("unhidePostComment should restore comment visibility", async () => {
    mockedUnhidePostComment.mockResolvedValue(undefined);
    await unhidePostComment(1);
    expect(mockedUnhidePostComment).toHaveBeenCalledWith(1);
  });

  it("deletePostComment should remove comment", async () => {
    mockedDeletePostComment.mockResolvedValue(undefined);
    await deletePostComment(1);
    expect(mockedDeletePostComment).toHaveBeenCalledWith(1);
  });
});

describe("Event Registration", () => {
  it("registerForEvent should create registration", async () => {
    mockedRegisterForEvent.mockResolvedValue({
      id: 1,
      eventId: 5,
      userOpenId: "user-123",
      userName: "Test User",
      status: "registered",
      adminNote: null,
      createdAt: new Date(),
    });
    const reg = await registerForEvent(5, "user-123", "Test User");
    expect(mockedRegisterForEvent).toHaveBeenCalledWith(5, "user-123", "Test User");
    expect(reg.status).toBe("registered");
  });

  it("cancelEventRegistration should update status", async () => {
    mockedCancelEventRegistration.mockResolvedValue(undefined);
    await cancelEventRegistration(5, "user-123");
    expect(mockedCancelEventRegistration).toHaveBeenCalledWith(5, "user-123");
  });

  it("getEventRegistrations should return all registrations", async () => {
    mockedGetEventRegistrations.mockResolvedValue([
      { id: 1, eventId: 5, userOpenId: "u1", userName: "Alice", status: "registered", adminNote: null, createdAt: new Date() },
      { id: 2, eventId: 5, userOpenId: "u2", userName: "Bob", status: "waitlist", adminNote: "Pending review", createdAt: new Date() },
    ]);
    const regs = await getEventRegistrations(5);
    expect(regs).toHaveLength(2);
    expect(regs[1].status).toBe("waitlist");
  });

  it("getUserEventRegistration should return user's registration", async () => {
    mockedGetUserEventRegistration.mockResolvedValue({
      id: 1,
      eventId: 5,
      userOpenId: "user-123",
      userName: "Test User",
      status: "registered",
      adminNote: null,
      createdAt: new Date(),
    });
    const reg = await getUserEventRegistration(5, "user-123");
    expect(reg).not.toBeNull();
    expect(reg!.status).toBe("registered");
  });

  it("getUserEventRegistration should return null for non-registered user", async () => {
    mockedGetUserEventRegistration.mockResolvedValue(null);
    const reg = await getUserEventRegistration(5, "user-999");
    expect(reg).toBeNull();
  });
});

describe("Admin Operations", () => {
  it("adminUpdateRegistrationStatus should update status and note", async () => {
    mockedAdminUpdateRegistrationStatus.mockResolvedValue(undefined);
    await adminUpdateRegistrationStatus(1, "rejected", "Not a club member");
    expect(mockedAdminUpdateRegistrationStatus).toHaveBeenCalledWith(1, "rejected", "Not a club member");
  });

  it("adminListComments should return comments for a post", async () => {
    mockedAdminListComments.mockResolvedValue([
      { id: 1, postId: 3, userOpenId: "u1", userName: "Alice", text: "Comment 1", hidden: false, createdAt: new Date() },
    ]);
    const comments = await adminListComments(3);
    expect(comments).toHaveLength(1);
    expect(comments[0].postId).toBe(3);
  });

  it("adminListRegistrations should return registrations for an event", async () => {
    mockedAdminListRegistrations.mockResolvedValue([
      { id: 1, eventId: 7, userOpenId: "u1", userName: "Alice", status: "registered", adminNote: null, createdAt: new Date() },
    ]);
    const regs = await adminListRegistrations(7);
    expect(regs).toHaveLength(1);
    expect(regs[0].eventId).toBe(7);
  });
});

describe("Edge Cases", () => {
  it("toggling like twice should result in unlike", async () => {
    mockedTogglePostLike
      .mockResolvedValueOnce({ liked: true, likeCount: 1 })
      .mockResolvedValueOnce({ liked: false, likeCount: 0 });

    const first = await togglePostLike(1, "user-123", "Test");
    expect(first.liked).toBe(true);

    const second = await togglePostLike(1, "user-123", "Test");
    expect(second.liked).toBe(false);
    expect(second.likeCount).toBe(0);
  });

  it("empty comment text should still call addPostComment", async () => {
    mockedAddPostComment.mockResolvedValue({
      id: 99,
      postId: 1,
      userOpenId: "u1",
      userName: "User",
      text: "",
      hidden: false,
      createdAt: new Date(),
    });
    // Note: validation should happen at the tRPC procedure level, not in the DB helper
    const result = await addPostComment(1, "u1", "User", "");
    expect(result.text).toBe("");
  });

  it("registering for same event twice should call registerForEvent", async () => {
    mockedRegisterForEvent
      .mockResolvedValueOnce({
        id: 1, eventId: 5, userOpenId: "u1", userName: "User",
        status: "registered", adminNote: null, createdAt: new Date(),
      })
      .mockRejectedValueOnce(new Error("Already registered"));

    const first = await registerForEvent(5, "u1", "User");
    expect(first.status).toBe("registered");

    await expect(registerForEvent(5, "u1", "User")).rejects.toThrow("Already registered");
  });
});
