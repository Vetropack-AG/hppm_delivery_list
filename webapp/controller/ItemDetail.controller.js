sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter"
], function (BaseController, formatter) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.ItemDetail", {
		formatter: formatter,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			this.getOwnerComponent().getRouter().getRoute("ItemDetail").attachPatternMatched(this.onRoutePatternMatched, this);
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onRoutePatternMatched: function (oEvent) {
			var sDeliveryKey = oEvent.getParameter("arguments").DeliveryKey;
			var sItemKey = oEvent.getParameter("arguments").ItemKey;
			this.getOwnerComponent().getModel().metadataLoaded(true).then(function () {
				this._bindView(sDeliveryKey, sItemKey);
			}.bind(this));
		},

		onSavePress: function () {
			var oModel = this.getView().getModel();
			if (oModel.hasPendingChanges()) {
				sap.ui.core.BusyIndicator.show(0);
				oModel.submitChanges({
					success: function () {
						sap.ui.core.BusyIndicator.hide();
						this.navBack();
					}.bind(this)
				});
			} else {
				this.navBack();
			}
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_bindView: function (sDeliveryKey, sItemKey) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/DeliveryItemSet", {
				DeliveryKey: sDeliveryKey,
				ItemKey: sItemKey
			});
			this.getView().bindElement(sPath);
		}

	});

});