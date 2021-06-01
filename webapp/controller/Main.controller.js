sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/library"
], function (BaseController, formatter, hppm) {
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

		onPrintProtocolPress: function () {
			var sDeliveryKey = this._getSelectedDeliveryKey();
			this.printProtocol(sDeliveryKey)
				.then(function () {
					this.showTranslatedMessageToast("message.protocolPrinted", [sDeliveryKey]);
				}.bind(this));
		},

		onCancelDeliveryPress: function () {
			var sDeliveryKey = this._getSelectedDeliveryKey();
			this.cancelDelivery(sDeliveryKey)
				.then(function () {
					this.showTranslatedMessageToast("message.deliveryCanceled", [sDeliveryKey]);
				}.bind(this));
		},

		onItemPress: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oContext = oItem.getBindingContext();
			var sTarget;
			if (oContext.getProperty("DeliveryType") === hppm.DELIVERY_TYPE.INTERNAL) {
				sTarget = "Detail";
			} else {
				sTarget = oContext.getProperty("ShipmentStatus") === hppm.SHIPMENT_STATUS.NEW ? "Registration" : "Detail";
			}
			this.navTo(sTarget, {
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