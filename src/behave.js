/**
 * Behave.js - The View-Model framework
 * Created by Roy Sommer, 2015
 */
var Behave = new (function() {

    var self = this;
    var views = {};
    var listeners = {};

    // First is the View selector, second is Component selector, third is Broadcast (channel) selector
    const BEHAVE_SELECTORS = ["$v", "$c", "$b"];

    /**
     * A view-model object
     * @param name {string}
     * @constructor
     */
    var BehaveView = function(name) {

        var self = this;
        var components = {};
        var model = {};
        var extensions = [];

        /**
         * Returns current view's identifier. To be used with extensions only.
         * @return {string}
         * @protected
         */
        this.__name__ = function() {
            return name;
        }

        /**
         * Define a new component within the scope of the current view-model
         * @param cmpName {string}
         * @param fn {Function} define with
         * @return {BehaveView}
         */
        this.component = function(cmpName, fn) {

            if (typeof cmpName != "string" || cmpName.length <= 0)
                throw new TypeError('First parameter expected to be a non-empty string');
            if (!(fn instanceof Function))
                throw new TypeError('Second parameter expected to be a function');
            if (components[cmpName])
                throw new SyntaxError(
                    'View-model (\''
                    + name
                    + '\') already contains a component of the same name (\''
                    + cmpName
                    + '\')'
                );

            components[cmpName] = new BehaveComponent(cmpName, name, fn);

            return self;

        };

        /**
         * Integrates current view model with an extension.
         * View model's streams will pipe through extensions before components
         * @param ext {Function}
         */
        this.uses = function(ext) {

            if (!(ext instanceof Function))
                throw new TypeError('First parameter expected to be a function');

            extensions.push(ext);

            return self;

        };

        /**
         * Subscribes a view to a certain channel
         * @param channel {string}
         */
        this.listens = function(channel) {

            if (typeof channel != "string" || channel.length == 0)
                throw new TypeError('First parameter expected to be a non-empty string');

            subscribeViewTo(channel, self);

            return self;

        };

        /**
         * Define the pattern used by the view model
         * @param modelObj {Object}
         * @return {BehaveView}
         */
        this.expects = function(modelObj) {

            if (typeof modelObj != "object")
                throw new TypeError('First parameter expected to be a literal object');

            if (!$.isEmptyObject(model))
                console.warn(
                    'Multiple \'uses\' declarations under view model (\''
                    + name
                    + '\')'
                );

            $.extend(model, modelObj);

            return self;

        };

        /**
         * Stream data through view model's components
         * @param input
         * @return {BehaveStream}
         */
        this.stream = function(input) {

            var stream = new BehaveStream(input);
            stream.__scope__(self);

            for (var i = 0; i < extensions.length; i++)
                extensions[i].apply(self, [stream]);

            for (cmp in components)
                components[cmp].stream(stream);

            return stream.returned();

        };

        /**
         * Returns an existing component interface
         * @param cmpName {string}
         * @return {BehaveComponent}
         */
        this.components = function(cmpName) {

            if (typeof cmpName != "string" || cmpName.length <= 0)
                throw new TypeError('First parameter expected to be a non-empty string');
            if (!components[cmpName])
                throw new RangeError(
                    'View-model (\''
                    + name
                    + '\') does not include the component (\''
                    + cmpName
                    + '\')'
                );

            return components[cmpName];

        };

    };

    /**
     * A component object
     * @constructor
     */
    var BehaveComponent = function(name, parent, fn) {

        var self = this;

        var DOMElement = function() {

            var el = $(
                '[data-view-model=\"'
                + parent
                + '\"] [data-component=\"'
                + name
                + '\"]'
            );

            if (el.length == 0)
                throw new ReferenceError(
                    'Unable to determine component (\''
                    + name
                    + '\')\'s corresponding DOM representation.'
                );

            return el;

        };

        /**
         * Pipes a stream through current component
         * @param stream {BehaveStream || Object}
         */
        this.stream = function(stream) {

            var scopeElement = DOMElement();

            if (!(stream instanceof BehaveStream))
                stream = new BehaveStream(stream);

            stream.__scope__(scopeElement);

            fn.apply(scopeElement, [stream]);

            return stream.returned();

        }

    };

    /**
     * A channel object
     * @param name {string}
     * @constructor
     */
    var BehaveChannel = function(name) {

        var self = this;

        if (typeof name != "string" || name.length <= 0)
            throw new TypeError('First paramter expected to be a non-empty string');

        this.stream = function(input) {

            var views = listeners[name] || [];

            for (var i = 0; i < views.length; i++)
                views[i].stream(input);

            return self;

        };

    };

    /**
     * A stream object. All streaming commands should expect this as parameter.
     * @param data {Object}
     * @constructor
     */
    var BehaveStream = function(data) {

        var self = this;
        var returnStream = {};
        var scope;

        if (!data)
            data = {};

        if (typeof data != "object")
            throw new TypeError('First parameter expected to be a literal object');

        data = $.extend({}, data);

        /**
         * The has statement serves as stream conditioning operator
         * @param key {string}
         * @return {{then: Function, and: Function, or: Function}}
         */
        this.has = function(key) {

            if (key in data)
                return {then: thenHas, and: this.has, or: orTrue};

            return {then: thenHasnt, and: andNot, or: orFalse};

        };

        /**
         * Gets an object field from the input stream
         * @param key {string}
         * @return {*|null}
         */
        this.get = function(key) {
            return data[key] || null;
        };

        /**
         * Append an object to the output stream
         * @param obj {Object}
         */
        this.return = function(obj) {

            if (typeof obj != "object")
                throw new TypeError('First parameter expected to be a literal object');

            $.extend(returnStream, obj);

        };

        /**
         * Reads the output stream
         * @return {Object}
         */
        this.returned = function() {
            return $.extend({}, returnStream);
        };

        /**
         * Sets the scope for the current stream. Changed by each component.
         * @param obj {Object}
         * @protected
         */
        this.__scope__ = function(obj) {
            scope = obj;
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called after a satisfied conditional.
         * @param fn {Function}
         * @return {{else: Function}}
         */
        var thenHas = function(fn) {
            fn.apply(scope);
            return {else: elseHasnt};
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called after an unsatisfied conditional.
         * @param fn {Function}
         * @return {{else: Function}}
         */
        var thenHasnt = function(fn) {
            return {else: elseHas};
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called after an unsatisfied conditional execute.
         * @param fn {Function}
         */
        var elseHas = function(fn) {
            fn.apply(scope);
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called after an unsatisfied conditional execute.
         * @param fn {Function}
         */
        var elseHasnt = function(fn) {
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called during conditional, if previous conditions were satisfied.
         * @type {Function}
         */
        var and = this.has;

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called during conditional, if previous conditions were unsatisfied.
         * @param fn {Function}
         * @return {{then: Function, and: Function, or: Function}}
         */
        var andNot = function(fn) {
            return {then: thenHasnt, and: andNot, or: orFalse};
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called during conditional, if previous conditions were satisfied.
         * @param fn {Function}
         * @return {{then: Function, and: Function, or: Function}}
         */
        var orTrue = function(fn) {
            return {then: thenHas, and: this.has, or: orTrue};
        };

        /**
         * INTERNAL CONDITIONAL FUNCTION. Called during conditional, if previous conditions were unsatisfied.
         * @type {Function}
         */
        var orFalse = this.has;

    };

    /**
     * Instantiate a new view-model or returns an existing one
     * @param name
     * @return {BehaveView}
     */
    this.view = function(name) {

        if (typeof name != "string" || name.length <= 0)
            throw new TypeError('First paramter expected to be a non-empty string');

        if (!views[name])
            views[name] = new BehaveView(name);

        return views[name];

    };

    /**
     * Return a dictionary of all views maintained by Behave
     * @return {*}
     */
    this.views = function(viewName){

        var clone;

        if (typeof viewName == "string" && viewName.length > 0) {
            if (views[viewName])
                return views[viewName];
            else
                throw new RangeError(
                    'Item (\''
                    + viewName
                    + '\') is not a registered view model'
                );
        }

        clone = {};

        for (view in views)
            clone[view] = views[view];

        return clone;

    }

    /**
     * Subscribes a view model to listen to the specified channel
     * @param channel {string}
     * @param view {BehaveView}
     */
    var subscribeViewTo = function(channel, view) {

        if (!listeners[channel])
            listeners[channel] = [];

        listeners[channel].push(view);

    };

    /**
     * The global view model selector.
     * @see this.views
     * @type {Function}
     */
    window[BEHAVE_SELECTORS[0]] = this.views;

    /**
     * The global component selector. Use from within view models.
     * @param cmpName {string}
     * @return BehaveComponent
     */
    window[BEHAVE_SELECTORS[1]] = function(cmpName) {

        var target, view;

        if (window.event && window.event.target) {
            target = $(window.event.target);
            view = target.parents('[data-view-model]');
        }

        if (view.length == 0)
            throw new ReferenceError(
                'Unable to determine parent view model.'
                + ' The component selector must be used within a view model scope'
            );

        if (typeof cmpName != "string" || cmpName.length <= 0)
            throw new TypeError('First paramter expected to be a non-empty string');

        if (!views[view.attr('data-view-model')])
            throw new RangeError(
                'Item (\''
                + view.attr('data-view-model')
                + '\') is not a registered view model'
            );

        return views[view.attr('data-view-model')].components(cmpName);

    };

    /**
     * The global channel broadcast selector.
     * @param chName {string}
     * @return BehaveChannel
     */
    window[BEHAVE_SELECTORS[2]] = function(chName) {
        return new BehaveChannel(chName);
    }

})();