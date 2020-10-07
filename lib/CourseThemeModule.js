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
    });
  }
  /** @override */
  async init() {
    await super.init();
  }
  applyHandler() {
    return async (req, res, next) => {
      try {
        const data = await this.find({ _id: req.apiData.query._id });
        res.sendStatus(204);
      } catch(e) {
        return next(e);
      }
    };
  }
}

module.exports = CourseThemeModule;
