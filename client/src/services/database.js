import Dexie from 'dexie';

/**
 * IndexedDB Database — Dexie.js wrapper for persistent local storage.
 * Stores novels, chapters, projects, scrape history, and EPUB exports.
 */
const db = new Dexie('WebNovelScraperDB');

db.version(1).stores({
  novels: '++id, title, author, siteUrl, adapter, createdAt',
  chapters: '++id, novelId, index, title, url, status, scrapedAt',
  projects: '++id, novelId, name, createdAt, updatedAt',
  scrapeJobs: '++id, projectId, status, startedAt, completedAt',
  epubExports: '++id, projectId, filename, createdAt',
  history: '++id, novelId, action, timestamp',
});

/**
 * Novel CRUD operations
 */
export const novelDB = {
  async add(novel) {
    return db.novels.add({
      ...novel,
      createdAt: new Date().toISOString(),
    });
  },

  async getAll() {
    return db.novels.orderBy('createdAt').reverse().toArray();
  },

  async getById(id) {
    return db.novels.get(id);
  },

  async update(id, changes) {
    return db.novels.update(id, changes);
  },

  async delete(id) {
    await db.chapters.where('novelId').equals(id).delete();
    return db.novels.delete(id);
  },

  async search(query) {
    const lower = query.toLowerCase();
    return db.novels.filter(n =>
      n.title?.toLowerCase().includes(lower) ||
      n.author?.toLowerCase().includes(lower)
    ).toArray();
  },
};

/**
 * Chapter CRUD operations
 */
export const chapterDB = {
  async addBulk(chapters) {
    return db.chapters.bulkAdd(chapters);
  },

  async getByNovel(novelId) {
    return db.chapters.where('novelId').equals(novelId).sortBy('index');
  },

  async getById(id) {
    return db.chapters.get(id);
  },

  async update(id, changes) {
    return db.chapters.update(id, changes);
  },

  async updateContent(id, content, wordCount) {
    return db.chapters.update(id, {
      content,
      wordCount,
      status: 'completed',
      scrapedAt: new Date().toISOString(),
    });
  },

  async deleteByNovel(novelId) {
    return db.chapters.where('novelId').equals(novelId).delete();
  },
};

/**
 * Project CRUD operations
 */
export const projectDB = {
  async add(project) {
    return db.projects.add({
      ...project,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  },

  async getAll() {
    return db.projects.orderBy('updatedAt').reverse().toArray();
  },

  async getById(id) {
    return db.projects.get(id);
  },

  async update(id, changes) {
    return db.projects.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
  },

  async delete(id) {
    return db.projects.delete(id);
  },
};

/**
 * History operations
 */
export const historyDB = {
  async add(entry) {
    return db.history.add({
      ...entry,
      timestamp: new Date().toISOString(),
    });
  },

  async getAll(limit = 100) {
    return db.history.orderBy('timestamp').reverse().limit(limit).toArray();
  },

  async getByNovel(novelId) {
    return db.history.where('novelId').equals(novelId).reverse().toArray();
  },

  async clear() {
    return db.history.clear();
  },
};

/**
 * EPUB Export operations
 */
export const epubDB = {
  async add(epub) {
    return db.epubExports.add({
      ...epub,
      createdAt: new Date().toISOString(),
    });
  },

  async getAll() {
    return db.epubExports.orderBy('createdAt').reverse().toArray();
  },

  async getById(id) {
    return db.epubExports.get(id);
  },

  async delete(id) {
    return db.epubExports.delete(id);
  },
};

/**
 * Utility: Get database stats
 */
export async function getDBStats() {
  const [novels, chapters, projects, exports, history] = await Promise.all([
    db.novels.count(),
    db.chapters.count(),
    db.projects.count(),
    db.epubExports.count(),
    db.history.count(),
  ]);
  return { novels, chapters, projects, exports, history };
}

export default db;
