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
  applyHandler() {
    return async (req, res, next) => {};
  }
  removeHandler() {
    return async (req, res, next) => {};
  }
}

module.exports = CourseThemeModule;
