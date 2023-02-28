import _ from 'lodash';
import AbstractApiModule from 'adapt-authoring-api';
import fs from 'fs/promises';
/**
 * Module which handles course theming
 * @memberof coursetheme
 * @extends {AbstractApiModule}
 */
class CourseThemeModule extends AbstractApiModule {
  /** @override */
  async setValues() {
    /** @ignore */ this.root = 'coursethemepresets';
    /** @ignore */ this.permissionsScope = 'content';
    /** @ignore */ this.schemaName = 'coursethemepreset';
    /** @ignore */ this.schemaExtensionName = 'coursethemepreset';
    /** @ignore */ this.collectionName = 'coursethemepresets';
    /** @ignore */ this.attributeKey = 'themeVariables';

    const perms = [`write:${this.permissionsScope}`];

    this.useDefaultRouteConfig();
    this.routes.push({
      route: '/:_id/apply/:courseId',
      validate: false,
      handlers: { post: this.applyHandler() },
      permissions: { post: perms }
    }, {
      route: '/:_id/remove/:courseId',
      validate: false,
      handlers: { post: this.removeHandler() },
      permissions: { post: perms }
    });
  }
  /** @override */
  async init() {
    await super.init();
    const [framework, content] = await this.app.waitForModule('adaptframework', 'content');
    /**
     * Cached module instance for easy access
     * @type {ContentModule}
     */
    this.content = content;
    framework.preBuildHook.tap(this.writeCustomLess.bind(this));
  }
  /**
   * Writes the customStyle and themeVariables attributes to LESS files. themeVariables are reduced into a string of variables, in the format `@key: value;`
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   */
  async writeCustomLess(fwBuild) {
    const fontImportString =  await this.processFileVariables(fwBuild);

    const { customStyle, [this.attributeKey]: variables } = fwBuild.courseData.course.data;
    return Promise.all([
      this.writeFile(fwBuild, '1-variables.less', fontImportString + this.getVariablesString(variables) ),
      this.writeFile(fwBuild, '2-customStyles.less', customStyle)
    ]);
  }
  /**
   * Generates a LESS variables string
   * @param {object} data The data to process
   * @param {string} variablesStr String memo to allow recursion
   * @return {string} The processed LESS varaibles string
   */
  getVariablesString(data = {}, variablesStr = '') {
    return Object.entries(data).reduce((s, [k, v]) => {
      if(_.isObject(v)) return this.getVariablesString(v, s);
      return v ? `${s}@${k}: ${v};\n` : s;
    }, variablesStr);
  }
  /**
   * Writes a file to the theme folder
   * @param {Object} fwBuild Build data
   * @param {String} filename Name of output file
   * @param {String} fileContents Contents to be written
   * @return {Promise}
   */
  async writeFile(fwBuild, filename, fileContents) {
    if(_.isEmpty(fileContents)) {
      return;
    }
    try {
      const outputDir = `${fwBuild.dir}/src/theme/${fwBuild.courseData.config.data._theme}/less/zzzzz`;
      await fs.mkdir(outputDir, { recursive: true });
      await fs.writeFile(`${outputDir}/${filename}`, fileContents);
    } catch(e) {
      this.log('error', `failed to write ${filename}, ${e.message}`);
    }
  }
  /**
   * Handles applying theme settings
   * @return {Function} Handler function
   */
  applyHandler() {
    return async (req, res, next) => {
      try {
        const { _id, courseId } = req.apiData.query;
        const [{ properties: presetProps }] = await this.find({ _id });
        await this.content.update({ _id: courseId }, { [this.attributeKey]: presetProps });
        res.sendStatus(204);
      } catch(e) {
        return next(e);
      }
    };
  }
  /**
   * Handles removing theme settings
   * @return {Function} Handler function
   */
  removeHandler() {
    return async (req, res, next) => {
      try {
        const { _id, courseId } = req.apiData.query;
        const [{ properties: presetProps }] = await this.find({ _id });
        const [{ themeVariables: existingProps }] = await this.content.find({ _id: courseId });
        await this.content.update({ _id: courseId }, { [this.attributeKey]: _.pickBy(existingProps, (v,k) => v !== presetProps[k]) });
        res.sendStatus(204);
      } catch(e) {
        return next(e);
      }
    };
  }

  /**
   * Copies uploaded font files into the build
   * @param {object} data The data to process
   */
  async processFileVariables(fwBuild) {
    const assets = await this.app.waitForModule('assets');
    const fontDest = `${fwBuild.dir}/src/theme/${fwBuild.courseData.config.data._theme}/fonts`;
    const fontData = fwBuild.courseData.course.data.themeVariables._font;

    if(!fontData) {
      return "";
    }
    let fontImportCSS = "";

    var fontWeightCheck = {
      'woff2-light': function () {
        return `font-weight: light;\n\tfont-style: normal;`;
      },
      'woff2-lightItalic': function () {
        return `font-weight: light;\n\tfont-style: italic;`;
      },
      'woff2-normal': function () {
        return `font-weight: normal;\n\tfont-style: normal;`;
      },
      'woff2-normalItalic': function () {
        return `font-weight: normal;\n\tfont-style: italic;`;
      },
      'woff2-bold': function () {
        return `font-weight: bold;\n\tfont-style: normal;`;
      },
      'woff2-boldItalic': function () {
        return `font-weight: bold;\n\tfont-style: italic;`;
      }
    }
    // font files
    if(fontData._items) {
      await Promise.all(fontData._items.map(async f => {
        if(!f["font-family"]) return;
        // copy each uploaded font file
        for (const font in f._files) {
          const [data] = await assets.find({ _id: f._files[font] });
          const asset = assets.createFsWrapper(data);
          try {
            await fs.writeFile(`${fontDest}/${f._files[font]}.${asset.data.subtype}`, await asset.read());
            // construct font import styling
            fontImportCSS += `@font-face {\n\tfont-family: ${f["font-family"]};\n\tsrc: url('./fonts/${f._files[font]}.${asset.data.subtype}') format('${asset.data.subtype}');\n\t${fontWeightCheck[font]()}\n}\n`;
          } catch(e) {
            this.log('error', `failed to write ${f._files[font]}, ${e.message}`);
          }
        }
      }));
      delete fontData._items;
    }
    // instruction style checkbox
    const _instruction = fontData._fontAssignments._instruction;
    if(_instruction["instruction-font-style"]) {
      _instruction["instruction-font-style"] = _instruction._isInstructionItalic ? 'italic' : 'normal';
      delete _instruction._isInstructionItalic;
    }   
    // external fonts
    if(fontData._externalFonts) {
      fontData._externalFonts.forEach(f => {
        if(f) fontImportCSS += `@import url('${f}');\n`;
      });
      delete fontData._externalFonts;
    }

    return fontImportCSS;
  }
}

export default CourseThemeModule;