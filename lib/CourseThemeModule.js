const _ = require('lodash');
const { promises: fs } = require('fs');
const AbstractApiModule = require('adapt-authoring-api');
/**
 * Module which handles course theming
 * @extends {AbstractApiModule}
 */
class CourseThemeModule extends AbstractApiModule {
  /** @override */
  async setValues() {
    /** @ignore */ this.root = 'coursethemepreset';
    /** @ignore */ this.schemaName = 'coursethemepreset';
    /** @ignore */ this.schemaExtensionName = 'coursethemepreset';
    /** @ignore */ this.collectionName = 'coursethemepresets';
    this.useDefaultRouteConfig();
    this.routes.push({
      route: '/:_id/apply',
      validate: false,
      handlers: { post: this.applyHandler() },
      permissions: { post: ['write:content'] }
    }, {
      route: '/:_id/remove',
      validate: false,
      handlers: { post: this.removeHandler() },
      permissions: { post: ['write:content'] }
    });
  }
  /** @override */
  async init() {
    const [framework, content] = await this.app.waitForModule('adaptFramework', 'content');
    this.content = content;
    framework.preBuildHook.tap(this.writeCustomLess.bind(this));
  }
  /**
   * Writes the customStyle and themeVariables attributes to LESS files. themeVariables are reduced into a string of variables, in the format `@key: value;`
   * @param {AdaptFrameworkBuild} fwBuild Reference to the current build
   */
  async writeCustomLess(fwBuild) {
    const customStyle = fwBuild.courseData.course.customStyle;
    const themeVariables = Object.entries(fwBuild.courseData.config.themeVariables || {}).reduce((s,[k,v]) => `${s}@${k}: ${v};/n`, '');
    return Promise.all([
      this.writeFile(fwBuild, '1-variables.less', themeVariables),
      this.writeFile(fwBuild, '2-customStyles.less', customStyle)
    ]);
  }
  async writeFile(fwBuild, filename, fileContents) {
    if(!_.isEmpty(fileContents)) {
      fs.writeFile(`${fwBuild.dir}/src/theme/${fwBuild.courseData.config._theme}/less/${filename}`, fileContents);
    }
  }
  applyHandler() {
    return async (req, res, next) => {};
  }
  removeHandler() {
    return async (req, res, next) => {};
  }
}

module.exports = CourseThemeModule;
