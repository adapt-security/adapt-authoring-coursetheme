import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { getVariablesString } from '../lib/utils/getVariablesString.js'

describe('getVariablesString()', () => {
  it('should return empty string for empty object', () => {
    assert.equal(getVariablesString({}), '')
  })

  it('should return empty string for undefined input', () => {
    assert.equal(getVariablesString(), '')
  })

  it('should generate LESS variable for simple key-value pair', () => {
    assert.equal(getVariablesString({ color: 'red' }), '@color: red;\n')
  })

  it('should generate multiple LESS variables', () => {
    const result = getVariablesString({ color: 'red', size: '16px' })
    assert.equal(result, '@color: red;\n@size: 16px;\n')
  })

  it('should recurse into nested objects', () => {
    const data = { outer: { inner: 'value' } }
    assert.equal(getVariablesString(data), '@inner: value;\n')
  })

  it('should handle deeply nested objects', () => {
    const data = { a: { b: { c: 'deep' } } }
    assert.equal(getVariablesString(data), '@c: deep;\n')
  })

  it('should skip falsy values', () => {
    const data = { color: 'red', empty: '', nullVal: null, zero: 0, valid: 'blue' }
    assert.equal(getVariablesString(data), '@color: red;\n@valid: blue;\n')
  })

  it('should accumulate with initial variablesStr', () => {
    const result = getVariablesString({ color: 'red' }, '@existing: value;\n')
    assert.equal(result, '@existing: value;\n@color: red;\n')
  })

  it('should handle mixed flat and nested properties', () => {
    const data = { flat: 'yes', nested: { inner: 'no' } }
    const result = getVariablesString(data)
    assert.ok(result.includes('@flat: yes;\n'))
    assert.ok(result.includes('@inner: no;\n'))
  })

  it('should treat arrays as objects and recurse into them', () => {
    // _.isObject returns true for arrays, so array indices become keys
    const data = { items: ['val1', 'val2'] }
    const result = getVariablesString(data)
    assert.ok(result.includes('@0: val1;\n'))
    assert.ok(result.includes('@1: val2;\n'))
  })
})
