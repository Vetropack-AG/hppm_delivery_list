sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"zvgt/hppm/delivery_list/model/models"
], function (UIComponent, Device, models) {
	"use strict";

	return UIComponent.extend("zvgt.hppm.delivery_list.Component", {

		metadata: {
			manifest: "json"
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);
			this.getRouter().initialize();
			this.setModel(models.createDeviceModel(), "device");
			this._registerMessageManager();
			this.getModel().attachRequestFailed(function() {
				sap.ui.core.BusyIndicator.hide();	
			});
		},

		/**
		 * Registers the messsage manager to the app.
		 * @private
		 * @name zvgt.hppm.delivery_create.Component#_registerMessageManager
		 * @method
		 */
		_registerMessageManager: function () {
			var oMessageManager = sap.ui.getCore().getMessageManager();
			oMessageManager.registerObject(this, true);
			var oMessageProcessor = new sap.ui.core.message.ControlMessageProcessor();
			oMessageManager.registerMessageProcessor(oMessageProcessor);
			this.setModel(sap.ui.getCore().getMessageManager().getMessageModel(), "message");
		},
	});
});