import _ from 'lodash'
import AbstractApiModule from 'adapt-authoring-api'
import fs from 'fs/promises'
import { getVariablesString, processCustomStyling } from './utils.js'
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
    const [framework, content, mongodb] = await this.app.waitForModule('adaptframework', 'content', 'mongodb')
    /**
     * Cached module instance for easy access
     * @type {ContentModule}
     */
    this.content = content
    framework.preBuildHook.tap(this.writeCustomLess.bind(this))
    // Preset names must be unique per theme (case-insensitive). Enforced in three
    // layers: normalise (trim) on write, a friendly pre-write check for a clean
    // 400, and a DB-level unique index (the integrity backstop, incl. races).
    this.preInsertHook.tap(async (data) => {
      if (typeof data.displayName === 'string') data.displayName = data.displayName.trim()
      await this.assertUniquePresetName(data.parentTheme, data.displayName)
    })
    this.preUpdateHook.tap(async (originalDoc, data) => {
      if (data.displayName === undefined) return
      if (typeof data.displayName === 'string') data.displayName = data.displayName.trim()
      await this.assertUniquePresetName(data.parentTheme ?? originalDoc.parentTheme, data.displayName, originalDoc._id)
    })
    // Case-insensitive per-theme unique index. Guarded: a dev DB with pre-existing
    // duplicates would otherwise fail index creation and block boot (the hooks
    // still enforce); a clean/production DB builds it and gains the DB guarantee.
    try {
      await mongodb.setIndex(this.collectionName, { parentTheme: 1, displayName: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } })
    } catch (e) {
      this.log('warn', `could not create unique preset-name index (existing duplicates?): ${e.message}`)
    }
  }

  /**
   * Throws if another preset for the same theme already uses this display name
   * (case-insensitive). Presets are unique per theme, so the same name may exist
   * under different `parentTheme` values.
   * @param {String} parentTheme
   * @param {String} displayName
   * @param {String} [excludeId] Ignore this preset (for renames)
   */
  async assertUniquePresetName (parentTheme, displayName, excludeId) {
    const name = (displayName ?? '').trim()
    if (!name || !parentTheme) return
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const matches = await this.find({ parentTheme, displayName: { $regex: `^${escaped}$`, $options: 'i' } })
    if (matches.some((p) => String(p._id) !== String(excludeId))) {
      throw this.app.errors.COURSETHEMEPRESET_NAME_EXISTS.setData({ displayName: name, parentTheme })
    }
  }

  /**
   * Writes the customStyle and themeVariables attributes to LESS files. themeVariables are reduced into a string of variables, in the format `@key: value;`
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   */
  async writeCustomLess (fwBuild) {
    const fontImportString = await this.processFileVariables(fwBuild)
    processCustomStyling(fwBuild.courseData)

    const { customStyle, [this.attributeKey]: variables, themeCustomStyle } = fwBuild.courseData.course.data
    return Promise.all([
      this.writeFile(fwBuild, '1-variables.less', fontImportString + getVariablesString(variables)),
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
   * Serves a theme's `theme.schema.json` (its colour/editor variable schema) so a
   * client can render a theme customiser. Read straight from the framework source
   * (`<frameworkDir>/src/theme/<themeName>/schema/theme.schema.json`) because theme
   * schemas — unlike core schemas — aren't registered with the jsonschema module.
   * @param {ClientRequest} req
   * @param {ServerResponse} res
   * @param {Function} next
   */
  async themeSchemaHandler (req, res, next) {
    try {
      const { themeName } = req.apiData.query
      // themeName is a plugin folder name; reject anything that could escape src/theme
      if (!/^[\w.-]+$/.test(themeName ?? '')) return next(this.app.errors.NO_SCHEMA_DEF)
      const framework = await this.app.waitForModule('adaptframework')
      const file = `${framework.path}/src/theme/${themeName}/schema/theme.schema.json`
      const schema = JSON.parse(await fs.readFile(file, 'utf8'))
      res.type('application/schema+json').json(schema)
    } catch (e) {
      if (e.code === 'ENOENT') return next(this.app.errors.NO_SCHEMA_DEF)
      return next(e)
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
      const [{ properties: presetProps }] = await this.find({ _id })
      await this.content.update({ _id: courseId }, { [this.attributeKey]: presetProps })
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
      const [{ properties: presetProps }] = await this.find({ _id })
      const [{ themeVariables: existingProps }] = await this.content.find({ _id: courseId })
      await this.content.update({ _id: courseId }, { [this.attributeKey]: _.pickBy(existingProps, (v, k) => v !== presetProps[k]) })
      res.sendStatus(204)
    } catch (e) {
      return next(e)
    }
  }

  /**
   * Copies uploaded font files into the build
   * @param {object} data The data to process
   */
  async processFileVariables (fwBuild) {
    const assets = await this.app.waitForModule('assets')
    const fontData = fwBuild.courseData.course.data.themeVariables._font

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
          const [data] = await assets.find({ _id: f._files[font] })
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
