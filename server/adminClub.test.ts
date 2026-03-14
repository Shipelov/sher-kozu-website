import { describe, expect, it } from "vitest";

type ClubPostRecord = {
  id: number;
  title: string;
  pinned: boolean;
  sortOrder: number;
};

type ClubEventRecord = {
  id: number;
  title: string;
  sortOrder: number;
};

type ClubMemberRecord = {
  id: number;
  name: string;
  animal: string;
  sortOrder: number;
};

function upsertRecord<T extends { id?: number }>(records: T[], nextRecord: T & { id?: number }) {
  if (nextRecord.id == null) {
    const nextId = records.reduce((max, record: any) => Math.max(max, record.id ?? 0), 0) + 1;
    return [...records, { ...nextRecord, id: nextId }];
  }

  return records.map((record) => (record.id === nextRecord.id ? { ...record, ...nextRecord } : record));
}

function deleteRecord<T extends { id: number }>(records: T[], id: number) {
  return records.filter((record) => record.id !== id);
}

function sortPosts(records: ClubPostRecord[]) {
  return [...records].sort((a, b) => {
    if (Number(b.pinned) !== Number(a.pinned)) return Number(b.pinned) - Number(a.pinned);
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

function sortByOrder<T extends { sortOrder: number; id: number }>(records: T[]) {
  return [...records].sort((a, b) => {
    if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
    return a.id - b.id;
  });
}

describe("admin club helpers", () => {
  it("creates and updates club posts while preserving ids", () => {
    const created = upsertRecord<ClubPostRecord>([], {
      title: "Новый пост",
      pinned: true,
      sortOrder: 0,
    });

    expect(created).toHaveLength(1);
    expect(created[0].id).toBe(1);

    const updated = upsertRecord(created, {
      id: 1,
      title: "Обновлённый пост",
      pinned: false,
      sortOrder: 2,
    });

    expect(updated).toEqual([
      {
        id: 1,
        title: "Обновлённый пост",
        pinned: false,
        sortOrder: 2,
      },
    ]);
  });

  it("sorts pinned posts before regular ones in admin dashboard views", () => {
    const sorted = sortPosts([
      { id: 2, title: "Обычный", pinned: false, sortOrder: 0 },
      { id: 3, title: "Закреплённый второй", pinned: true, sortOrder: 3 },
      { id: 1, title: "Закреплённый первый", pinned: true, sortOrder: 1 },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 3, 2]);
  });

  it("deletes events by id without affecting other records", () => {
    const records: ClubEventRecord[] = [
      { id: 1, title: "Весенний визит", sortOrder: 0 },
      { id: 2, title: "Онлайн-встреча", sortOrder: 1 },
    ];

    expect(deleteRecord(records, 1)).toEqual([{ id: 2, title: "Онлайн-встреча", sortOrder: 1 }]);
  });

  it("sorts members by explicit order for predictable rendering", () => {
    const sorted = sortByOrder<ClubMemberRecord>([
      { id: 3, name: "Семья А", animal: "Белла", sortOrder: 2 },
      { id: 1, name: "Семья Б", animal: "Марта", sortOrder: 0 },
      { id: 2, name: "Семья В", animal: "Луна", sortOrder: 1 },
    ]);

    expect(sorted.map((item) => item.id)).toEqual([1, 2, 3]);
  });
});
