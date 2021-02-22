sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter"
], function (BaseController, formatter) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Main", {
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {

		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onPrintDeliveryPress: function () {
			// var sDeliveryKey = this._getSelectedDeliveryKey();
			this.showSuccessMessage("test");
		},

		onPrintProtocolPress: function () {
			this.showErrorMessage("test123");
		},

		onItemPress: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oContext = oItem.getBindingContext();
			this.navTo("Registration", {
				DeliveryKey: oContext.getModel().getProperty(oContext.getPath() + "/DeliveryKey")
			});
		},

		onNavToCreateDeliveryPress: function () {
			var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (oCrossAppNav) {
				oCrossAppNav.toExternal({ // eslint-disable-line
					target: {
						semanticObject: "delivery_create",
						action: "display"
					}
				});
			}
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_getSelectedDeliveryKey: function () {
			var oData = this._getSelectedDelivery();
			return oData ? oData.DeliveryKey : undefined;
		},

		_getSelectedDelivery: function () {
			var oTable = this._getTable();
			var aContexts = oTable.getSelectedContexts();
			if (aContexts[0]) {
				return aContexts[0].getModel().getProperty(aContexts[0].getPath());
			}
			return undefined;
		},

		_getTable: function () {
			return this.getView().byId("SmartTable").getTable();
		}
	});
});