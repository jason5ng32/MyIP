// Single source of truth is common/valid-ip.js (shared with the backend).
// This file exists as a thin re-export so front-end code can keep writing
// `import { isValidIP } from '@/utils/valid-ip.js'` without caring where
// the implementation lives. tests/valid-ip.test.js imports both paths and
// asserts they return the same verdict — that keeps the re-export honest.
export { isValidIP } from '../../common/valid-ip.js';
