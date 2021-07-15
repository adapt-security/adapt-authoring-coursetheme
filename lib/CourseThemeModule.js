const _ = require('lodash');
const fs = require('fs').promises;
const AbstractApiModule = require('adapt-authoring-api');
/**
 * Module which handles course theming
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
    super.init();
    const [framework, content] = await this.app.waitForModule('adaptFramework', 'content');
    this.content = content;
    framework.preBuildHook.tap(this.writeCustomLess.bind(this));
  }
  /**
   * Writes the customStyle and themeVariables attributes to LESS files. themeVariables are reduced into a string of variables, in the format `@key: value;`
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   */
  async writeCustomLess(fwBuild) {
    const courseData = fwBuild.courseData.course.data;
    const customStyle = courseData.customStyle;
    const themeVariables = Object.entries(courseData.themeVariables || {}).reduce((s,[k,v]) => {
      Object.entries(v).forEach(([k2,v2]) => {
        if(v2) s += `@${k}-${k2}: ${v2};\n`;
      });
      return s;
    }, '');
    return Promise.all([
      this.writeFile(fwBuild, '1-variables.less', themeVariables),
      this.writeFile(fwBuild, '2-customStyles.less', customStyle)
    ]);
  }
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
  applyHandler() {
    return async (req, res, next) => {
      try {
        const { _id, courseId } = req.apiData.query;
        const { properties: presetProps } = await this.find({ _id });
        await this.content.update({ _id: courseId }, presetProps);
        res.sendStatus(204);
      } catch(e) {
        return next(e);
      }
    };
  }
  removeHandler() {
    return async (req, res, next) => {
      try {
        const { _id, courseId } = req.apiData.query;
        const { properties: presetProps } = await this.find({ _id });
        const { themeVariables: existingProps } = await this.content.find({ _id: courseId });
        await this.content.update({ _id: courseId }, { themeVariables: _.pickBy(existingProps, (v,k) => v !== presetProps[k]) });
        res.sendStatus(204);
      } catch(e) {
        return next(e);
      }
    };
  }
}

module.exports = CourseThemeModule;