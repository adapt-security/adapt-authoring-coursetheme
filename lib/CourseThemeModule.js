import _ from 'lodash'
import AbstractApiModule from 'adapt-authoring-api'
import fs from 'fs/promises'
import semver from 'semver'
import { getVariablesString, processCustomStyling } from './utils.js'

const CONFIG_THEME_VARS_MIN_VERSION = '6.61.0' // adjust to actual release version

/**
 * Module which handles course theming
 * @memberof coursetheme
 * @extends {AbstractApiModule}
 */
class CourseThemeModule extends AbstractApiModule {
  /** @override */
  async setValues () {
    await super.setValues()
    /** @ignore */ this.schemaName = 'coursethemepreset'
    /** @ignore */ this.schemaExtensionName = 'coursethemepreset'
    /** @ignore */ this.collectionName = 'coursethemepresets'
    /** @ignore */ this.attributeKey = 'themeVariables'
  }

  /** @override */
  async init () {
    await super.init()
    const [framework, content] = await this.app.waitForModule('adaptframework', 'content')
    /**
     * Cached module instance for easy access
     * @type {ContentModule}
     */
    this.content = content
    /**
     * Cached module instance for easy access
     * @type {AdaptFrameworkModule}
     */
    this.framework = framework
    framework.preBuildHook.tap(this.writeCustomLess.bind(this))
    framework.registerImportContentMigration(async (data, importer) => {
      if (data._type === 'course' && data.themeVariables) {
        importer._themeVariablesMigration = data.themeVariables
        delete data.themeVariables
      }
      if (data._type === 'config' && importer._themeVariablesMigration) {
        data.themeVariables = importer._themeVariablesMigration
        delete importer._themeVariablesMigration
      }
    })
  }

  /**
   * Writes the customStyle and themeVariables attributes to LESS files. themeVariables are reduced into a string of variables, in the format `@key: value;`
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   */
  async writeCustomLess (fwBuild) {
    const configData = fwBuild.courseData.config.data
    const courseData = fwBuild.courseData.course.data
    // prefer config, fall back to course for unmigrated data
    const variables = configData[this.attributeKey] || courseData[this.attributeKey] || {}

    const fontImportString = await this.processFileVariables(fwBuild, variables)
    processCustomStyling(fwBuild.courseData, variables)

    const { customStyle, themeCustomStyle } = courseData
    const frameworkHandlesVars = semver.gte(this.framework.version, CONFIG_THEME_VARS_MIN_VERSION)

    return Promise.all([
      this.writeFile(fwBuild, '1-variables.less',
        frameworkHandlesVars ? fontImportString : fontImportString + getVariablesString(variables)),
      this.writeFile(fwBuild, '2-customStyles.less', customStyle),
      this.writeFile(fwBuild, '3-themeCustomStyles.less', themeCustomStyle)
    ])
  }

  /**
   * Writes a file to the theme folder
   * @param {Object} fwBuild Build data
   * @param {String} filename Name of output file
   * @param {String} fileContents Contents to be written
   * @return {Promise}
   */
  async writeFile (fwBuild, filename, fileContents) {
    if (_.isEmpty(fileContents)) {
      return
    }
    try {
      const outputDir = `${fwBuild.dir}/src/theme/${fwBuild.courseData.config.data._theme}/less/zzzzz`
      await fs.mkdir(outputDir, { recursive: true })
      await fs.writeFile(`${outputDir}/${filename}`, fileContents)
    } catch (e) {
      this.log('error', `failed to write ${filename}, ${e.message}`)
    }
  }

  /**
   * Handles applying theme settings
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  async applyHandler (req, res, next) {
    try {
      const { _id, courseId } = req.apiData.query
      const { properties: presetProps } = await this.findOne({ _id })
      const config = await this.content.findOne({ _courseId: courseId, _type: 'config' })
      await this.content.update({ _id: config._id }, { [this.attributeKey]: presetProps })
      res.sendStatus(204)
    } catch (e) {
      return next(e)
    }
  }

  /**
   * Handles removing theme settings
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  async removeHandler (req, res, next) {
    try {
      const { _id, courseId } = req.apiData.query
      const { properties: presetProps } = await this.findOne({ _id })
      const config = await this.content.findOne({ _courseId: courseId, _type: 'config' })
      const existingProps = config[this.attributeKey] || {}
      await this.content.update({ _id: config._id }, { [this.attributeKey]: _.pickBy(existingProps, (v, k) => v !== presetProps[k]) })
      res.sendStatus(204)
    } catch (e) {
      return next(e)
    }
  }

  /**
   * Copies uploaded font files into the build
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   * @param {Object} variables The theme variables object
   */
  async processFileVariables (fwBuild, variables) {
    const assets = await this.app.waitForModule('assets')
    const fontData = variables?._font

    if (!fontData) {
      return ''
    }
    let fontImportCSS = ''
    // font files
    if (fontData._items) {
      await Promise.all(fontData._items.map(async f => {
        if (!f['font-family']) return
        // copy each uploaded font file
        for (const font in f._files) {
          const data = await assets.findOne({ _id: f._files[font] })
          const asset = assets.createFsWrapper(data)
          try {
            const relativeFontPath = `fonts/${f._files[font]}.${asset.data.subtype}`
            const absoluteFontPath = `${fwBuild.dir}/src/theme/${fwBuild.courseData.config.data._theme}/${relativeFontPath}`
            await fs.writeFile(absoluteFontPath, await asset.read())
            // construct font import styling
            fontImportCSS += `@font-face ${JSON.stringify({
              'font-family': `${f['font-family']};`,
              src: `url('./${relativeFontPath}') format('${asset.data.subtype}');`,
              'font-weight': `${font.includes('light') ? 'light' : font.includes('bold') ? 'bold' : 'normal'};`,
              'font-style': `${font.includes('Italic') ? 'italic' : 'normal'};`
            }, null, 2)}`
          } catch (e) {
            this.log('error', `failed to write ${f._files[font]}, ${e.message}`)
          }
        }
      }))
      delete fontData._items
    }
    // instruction style checkbox
    const _instruction = fontData._fontAssignments._instruction
    if (_instruction['instruction-font-style']) {
      _instruction['instruction-font-style'] = _instruction._isInstructionItalic ? 'italic' : 'normal'
      delete _instruction._isInstructionItalic
    }
    // external fonts
    if (fontData._externalFonts) {
      fontData._externalFonts.forEach(f => {
        if (f) fontImportCSS += `@import url('${f}');\n`
      })
      delete fontData._externalFonts
    }

    return fontImportCSS
  }
}

export default CourseThemeModule
