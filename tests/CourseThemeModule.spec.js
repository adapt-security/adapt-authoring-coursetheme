import { describe, it, mock } from 'node:test'
import assert from 'node:assert/strict'
import CourseThemeModule from '../lib/CourseThemeModule.js'

/**
 * CourseThemeModule extends AbstractApiModule and requires a running app.
 * We test getVariablesString and processCustomStyling in isolation.
 */

function createInstance () {
  const mockApp = {
    waitForModule: mock.fn(async () => {}),
    errors: {},
    dependencyloader: {
      moduleLoadedHook: { tap: () => {}, untap: () => {} }
    }
  }

  const originalInit = CourseThemeModule.prototype.init
  CourseThemeModule.prototype.init = async function () {}
  const originalSetValues = CourseThemeModule.prototype.setValues
  CourseThemeModule.prototype.setValues = async function () {}

  const instance = new CourseThemeModule(mockApp, { name: 'adapt-authoring-coursetheme' })

  CourseThemeModule.prototype.init = originalInit
  CourseThemeModule.prototype.setValues = originalSetValues

  instance.attributeKey = 'themeVariables'

  return instance
}

describe('CourseThemeModule', () => {
  describe('#getVariablesString()', () => {
    it('should return an empty string for empty data', () => {
      const instance = createInstance()
      assert.equal(instance.getVariablesString({}), '')
    })

    it('should generate LESS variable for a simple key-value pair', () => {
      const instance = createInstance()
      const result = instance.getVariablesString({ color: '#fff' })
      assert.equal(result, '@color: #fff;\n')
    })

    it('should generate multiple LESS variables', () => {
      const instance = createInstance()
      const result = instance.getVariablesString({ a: '1', b: '2' })
      assert.ok(result.includes('@a: 1;\n'))
      assert.ok(result.includes('@b: 2;\n'))
    })

    it('should recurse into nested objects', () => {
      const instance = createInstance()
      const result = instance.getVariablesString({
        _colors: { primary: 'red', secondary: 'blue' }
      })
      assert.ok(result.includes('@primary: red;\n'))
      assert.ok(result.includes('@secondary: blue;\n'))
    })

    it('should skip falsy values', () => {
      const instance = createInstance()
      const result = instance.getVariablesString({ a: '', b: null, c: 'valid' })
      assert.ok(!result.includes('@a:'))
      assert.ok(!result.includes('@b:'))
      assert.ok(result.includes('@c: valid;\n'))
    })

    it('should use the provided variablesStr as initial value', () => {
      const instance = createInstance()
      const result = instance.getVariablesString({ a: '1' }, '@existing: yes;\n')
      assert.ok(result.startsWith('@existing: yes;\n'))
      assert.ok(result.includes('@a: 1;\n'))
    })

    it('should default data to empty object', () => {
      const instance = createInstance()
      assert.equal(instance.getVariablesString(), '')
    })
  })

  describe('#processCustomStyling()', () => {
    it('should move themeCustomStyle to top-level course data', () => {
      const instance = createInstance()
      const fwBuild = {
        courseData: {
          course: {
            data: {
              themeVariables: {
                themeCustomStyle: '.custom { color: red; }'
              }
            }
          }
        }
      }
      instance.processCustomStyling(fwBuild)
      assert.equal(fwBuild.courseData.course.data.themeCustomStyle, '.custom { color: red; }')
      assert.equal(fwBuild.courseData.course.data.themeVariables.themeCustomStyle, undefined)
    })

    it('should do nothing when themeCustomStyle is falsy', () => {
      const instance = createInstance()
      const fwBuild = {
        courseData: {
          course: {
            data: {
              themeVariables: {}
            }
          }
        }
      }
      instance.processCustomStyling(fwBuild)
      assert.equal(fwBuild.courseData.course.data.themeCustomStyle, undefined)
    })
  })
})
