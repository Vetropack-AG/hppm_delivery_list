sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/delivery_list/model/constants",
	"zvgt/hppm/delivery_list/model/quantityCalculator"
], function (BaseController, formatter, constants, quantityCalculator) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.ItemDetail", {
		formatter: formatter,
		quantityCalculator:quantityCalculator,

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
					success: function (oData) {
						if (!this.isSubmitError(oData)) {
							sap.ui.core.BusyIndicator.hide();
							this.showTranslatedMessageToast("message.itemSaved", [this.getDeliveryProperty("ItemKey")]);
						} else {
							this.getView().getModel().resetChanges();
						}
					}.bind(this)
				});
			}
		},

		onCancelPress: function () {
			this.getView().getModel().resetChanges();
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

		onPrintItemPress: function () {
			var sDeliveryKey = this.getDeliveryProperty("DeliveryKey");
			var sItemKey = this.getDeliveryProperty("ItemKey");
			this.printItem(sDeliveryKey, sItemKey)
				.then(function () {
					this.showTranslatedMessageToast("message.itemPrinted", [sItemKey]);
				}.bind(this));
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