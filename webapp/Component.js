sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"zvgt/hppm/delivery/list/model/models",
	"sap/m/MessageBox"
], function (UIComponent, Device, models, MessageBox) {
	"use strict";

	return UIComponent.extend("zvgt.hppm.delivery.list.Component", {

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
			
			this._loadHppmLibrary();
			zvgt.hppm.addBTPCustomerNumberToHttpHeader(this);

			this.getRouter().initialize();
			this.setModel(models.createDeviceModel(), "device");
			this._registerMessageManager();
			this._registerODataModelHandlers();
			this._addShellHeaderHomeButton();
			this.getModel().setSizeLimit(9999);
			this.getModel("UI").setProperty("/IsInternalUser", !zvgt.hppm.isExternalUser());
			this.getModel("UI").setProperty("/IsAllowedPosting", !zvgt.hppm.isExternalUser());
		},

		_loadHppmLibrary: function() {
			var sAppId = this.getManifestEntry("/sap.app/id");
			var sAppPath = sAppId.replaceAll(".", "/");
			var sAppModulePath = jQuery.sap.getModulePath(sAppPath);
			var sLibraryPath = this._isCloudEnvironment() ? `${sAppModulePath}/zvgt/hppm` : "/sap/bc/ui5_ui5/sap/zvgt_controls/";
			sap.ui.getCore().loadLibrary("zvgt.hppm", sLibraryPath);
		},

		_isCloudEnvironment: function() {
			return location.hostname.includes("hana.ondemand") || location.hostname.includes("cfapps.eu");
		},

		_registerODataModelHandlers: function () {
			this.getModel().attachRequestFailed(function (oEvent) {
				sap.ui.core.BusyIndicator.hide();
				this._showServerErrorMessage(oEvent);
			}.bind(this));
			this.getModel().attachRequestCompleted(function (oEvent) {
				sap.ui.core.BusyIndicator.hide();
			});
		},

		_showServerErrorMessage: function (oEvent) {
			var sMessage;
			try {
				var oResponse = oEvent.getParameter ? oEvent.getParameter("response") : oEvent;
				var oResponseText = JSON.parse(oResponse.responseText);
				sMessage = oResponseText.error.message.value;
				if (!sMessage || sMessage === "") {
					sMessage = oEvent.getParameter("response").message;
				}
			} catch (err) {
				try {
					var parser = new DOMParser();
					var xmlDoc = parser.parseFromString(oResponse.responseText, "text/xml");
					sMessage = xmlDoc.getElementsByTagName("message")[0].childNodes[0].nodeValue;
				} catch (err2) {
					sMessage = oEvent.getParameter("response").message;
				}
			}
			MessageBox.error(sMessage);
			sap.ui.getCore().getMessageManager().addMessages(
				new sap.ui.core.message.Message({
					message: sMessage,
					type: "Error"
				})
			);
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

		_addShellHeaderHomeButton: function () {
			var rendererPromise = this._getShellRenderer();
			rendererPromise.then(function (oRenderer) {
				oRenderer.addHeaderItem("sap.ushell.ui.shell.ShellHeadItem", {
					icon: "sap-icon://home",
					press: this._navHome
				}, true, true);
			}.bind(this));
		},

		_navHome: function () {
			var oCrossAppNavigator = sap.ushell.Container.getService("CrossApplicationNavigation");
			oCrossAppNavigator.toExternal({ // eslint-disable-line
				target: {
					semanticObject: "#"
				}
			});
		},

		_getShellRenderer: function () {
			var that = this,
				oDeferred = new jQuery.Deferred(),
				oRenderer;

			that._oShellContainer = jQuery.sap.getObject("sap.ushell.Container");
			if (!that._oShellContainer) {
				oDeferred.reject(
					"Illegal state: shell container not available; this component must be executed in a unified shell runtime context.");
			} else {
				oRenderer = that._oShellContainer.getRenderer();
				if (oRenderer) {
					oDeferred.resolve(oRenderer);
				} else {
					// renderer not initialized yet, listen to rendererCreated event
					that._onRendererCreated = function (oEvent) {
						oRenderer = oEvent.getParameter("renderer");
						if (oRenderer) {
							oDeferred.resolve(oRenderer);
						} else {
							oDeferred.reject("Illegal state: shell renderer not available after recieving 'rendererLoaded' event.");
						}
					};
					that._oShellContainer.attachRendererCreatedEvent(that._onRendererCreated);
				}
			}
			return oDeferred.promise();
		}
	});
});