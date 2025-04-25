import { Cache } from '../../src/cache';

describe('Cache Implementation', () => {
  let cache: Cache<string>;
  
  beforeEach(() => {
    // Create a new cache instance before each test with a short TTL for testing
    cache = new Cache<string>(100, 5); // 100ms TTL, max 5 entries
  });
  
  describe('set and get', () => {
    it('should store and retrieve values', () => {
      const key = 'test-key';
      const value = 'test-value';
      
      cache.set(key, value);
      expect(cache.get(key)).toBe(value);
    });
    
    it('should return undefined for non-existent keys', () => {
      expect(cache.get('non-existent')).toBeUndefined();
    });
    
    it('should override existing values', () => {
      const key = 'test-key';
      cache.set(key, 'old-value');
      cache.set(key, 'new-value');
      
      expect(cache.get(key)).toBe('new-value');
    });
  });
  
  describe('has', () => {
    it('should return true for existing keys', () => {
      const key = 'test-key';
      cache.set(key, 'test-value');
      
      expect(cache.has(key)).toBe(true);
    });
    
    it('should return false for non-existent keys', () => {
      expect(cache.has('non-existent')).toBe(false);
    });
  });
  
  describe('delete', () => {
    it('should remove values from the cache', () => {
      const key = 'test-key';
      cache.set(key, 'test-value');
      
      expect(cache.has(key)).toBe(true);
      expect(cache.delete(key)).toBe(true);
      expect(cache.has(key)).toBe(false);
      expect(cache.get(key)).toBeUndefined();
    });
    
    it('should return false when deleting non-existent keys', () => {
      expect(cache.delete('non-existent')).toBe(false);
    });
  });
  
  describe('clear', () => {
    it('should remove all values from the cache', () => {
      cache.set('key1', 'value1');
      cache.set('key2', 'value2');
      
      expect(cache.size()).toBe(2);
      cache.clear();
      expect(cache.size()).toBe(0);
      expect(cache.get('key1')).toBeUndefined();
      expect(cache.get('key2')).toBeUndefined();
    });
  });
  
  describe('size', () => {
    it('should return the number of entries in the cache', () => {
      expect(cache.size()).toBe(0);
      
      cache.set('key1', 'value1');
      expect(cache.size()).toBe(1);
      
      cache.set('key2', 'value2');
      expect(cache.size()).toBe(2);
      
      cache.delete('key1');
      expect(cache.size()).toBe(1);
      
      cache.clear();
      expect(cache.size()).toBe(0);
    });
  });
  
  describe('expiration', () => {
    it('should expire entries after TTL', async () => {
      const key = 'expiring-key';
      cache.set(key, 'expiring-value');
      
      expect(cache.get(key)).toBe('expiring-value');
      
      // Wait for the entry to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      expect(cache.get(key)).toBeUndefined();
      expect(cache.has(key)).toBe(false);
    });
    
    it('should respect custom TTL for specific entries', async () => {
      const shortKey = 'short-ttl';
      const longKey = 'long-ttl';
      
      // Set with default TTL (100ms)
      cache.set(shortKey, 'short-value');
      
      // Set with custom TTL (300ms)
      cache.set(longKey, 'long-value', 300);
      
      // Wait for default TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Short TTL entry should be expired
      expect(cache.get(shortKey)).toBeUndefined();
      
      // Long TTL entry should still be available
      expect(cache.get(longKey)).toBe('long-value');
      
      // Wait for long TTL to expire
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Now both should be expired
      expect(cache.get(longKey)).toBeUndefined();
    });
  });
  
  describe('max entries limit', () => {
    it('should enforce maximum entries limit', () => {
      // Fill the cache to its maximum capacity (5 entries)
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      expect(cache.size()).toBe(5);
      
      // Add one more entry, which should evict the oldest one
      cache.set('new-key', 'new-value');
      
      expect(cache.size()).toBe(5);
      expect(cache.get('key0')).toBeUndefined(); // Oldest entry should be evicted
      expect(cache.get('new-key')).toBe('new-value');
    });
    
    it('should not evict entries when updating existing keys', () => {
      // Fill the cache to its maximum capacity
      for (let i = 0; i < 5; i++) {
        cache.set(`key${i}`, `value${i}`);
      }
      
      // Update an existing key
      cache.set('key0', 'updated-value');
      
      expect(cache.size()).toBe(5);
      expect(cache.get('key0')).toBe('updated-value');
      
      // All other entries should still be present
      for (let i = 1; i < 5; i++) {
        expect(cache.get(`key${i}`)).toBe(`value${i}`);
      }
    });
  });
  
  describe('prune', () => {
    it('should remove expired entries', async () => {
      // Add some entries with different TTLs
      cache.set('expire1', 'value1', 50);
      cache.set('expire2', 'value2', 50);
      cache.set('keep', 'value3', 200);
      
      expect(cache.size()).toBe(3);
      
      // Wait for some entries to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Before pruning, size still reports all entries
      expect(cache.size()).toBe(3);
      
      // Prune should remove expired entries
      const removed = cache.prune();
      expect(removed).toBe(2);
      
      // After pruning, size should be updated
      expect(cache.size()).toBe(1);
      expect(cache.get('expire1')).toBeUndefined();
      expect(cache.get('expire2')).toBeUndefined();
      expect(cache.get('keep')).toBe('value3');
    });
    
    it('should return 0 when no entries are expired', () => {
      cache.set('key', 'value', 1000); // Long TTL
      
      const removed = cache.prune();
      expect(removed).toBe(0);
      expect(cache.size()).toBe(1);
    });
  });
  
  describe('getOrSet', () => {
    it('should return cached value if available', async () => {
      const key = 'cached-key';
      cache.set(key, 'cached-value');
      
      const factory = jest.fn().mockResolvedValue('factory-value');
      
      const result = await cache.getOrSet(key, factory);
      
      expect(result).toBe('cached-value');
      expect(factory).not.toHaveBeenCalled();
    });
    
    it('should call factory and cache result if key not found', async () => {
      const key = 'new-key';
      const factory = jest.fn().mockResolvedValue('factory-value');
      
      const result = await cache.getOrSet(key, factory);
      
      expect(result).toBe('factory-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get(key)).toBe('factory-value');
    });
    
    it('should call factory and cache result if key is expired', async () => {
      const key = 'expiring-key';
      cache.set(key, 'old-value', 50);
      
      // Wait for the entry to expire
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const factory = jest.fn().mockResolvedValue('new-value');
      
      const result = await cache.getOrSet(key, factory);
      
      expect(result).toBe('new-value');
      expect(factory).toHaveBeenCalledTimes(1);
      expect(cache.get(key)).toBe('new-value');
    });
    
    it('should use custom TTL when provided', async () => {
      const key = 'custom-ttl';
      const factory = jest.fn().mockResolvedValue('factory-value');
      
      await cache.getOrSet(key, factory, 200);
      
      // Wait for default TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Value should still be in cache due to custom TTL
      expect(cache.get(key)).toBe('factory-value');
    });
  });
});