sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/delivery_list/model/constants"
], function (BaseController, formatter, constants) {
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
			this._setNextStatus();
			var oModel = this.getView().getModel();
			if (oModel.hasPendingChanges()) {
				sap.ui.core.BusyIndicator.show(0);
				oModel.submitChanges({
					success: function () {
						sap.ui.core.BusyIndicator.hide();
						this.showTranslatedMessageToast("message.itemSaved", [this.getDeliveryProperty("ItemKey")]);
						// this.navBack();
					}.bind(this)
				});
			} else {
				// this.navBack();
			}
		},

		onSapPostingPress: function () {
			this.getFragment("PostItemDialog", this).open();
		},

		onPostItemDialogSavePress: function (oEvent) {
			var oDialog = this.getFragment("PostItemDialog", this);
			oDialog.close();
			var sQuantity = oDialog.getContent()[0].getValue().toString();
			this._handlePostGoodsMovement(sQuantity);
		},

		onPostItemCancelSavePress: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_handlePostGoodsMovement: function (sQuantity) {
			this.postGoodsMovement({
				DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
				ItemKey: this.getDeliveryProperty("ItemKey"),
				Quantity: sQuantity
			}).then(this._showItemPosted.bind(this));
		},

		_showItemPosted: function () {
			this.showTranslatedMessageToast("message.itemPosted", [this.getDeliveryProperty("ItemKey")]);
		},

		_setNextStatus: function () {
			// OPEN -> QUALITY -> QUANTITY
			var sCurrentStatus = this.getDeliveryProperty("InspectionStatus");
			switch (sCurrentStatus) {
			case constants.INSPECTION_STATUS.OPEN:
				this.setDeliveryProperty("InspectionStatus", "QUALITY");
				break;
			case constants.INSPECTION_STATUS.QUALITY:
				this.setDeliveryProperty("InspectionStatus", "QUANTITY");
				break;
			default: // to nothing
			}
		},

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