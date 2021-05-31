sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/library",
	"zvgt/hppm/delivery_list/model/quantityCalculator"
], function (BaseController, formatter, hppm, quantityCalculator) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.ItemDetail", {
		formatter: formatter,
		quantityCalculator: quantityCalculator,

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
			this.getFragment("CreateLabelDialog", this).open();
		},

		onCreateLabelDialogSavePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			oDialog.close();
			var iAmount = oDialog.getContent()[0].getItems()[1].getValue();
			var sDeliveryKey = this.getDeliveryProperty("DeliveryKey");
			var sItemKey = this.getDeliveryProperty("ItemKey");
			this.printItem(sDeliveryKey, sItemKey, iAmount)
				.then(function () {
					this.showTranslatedMessageToast("message.itemPrinted", [sItemKey]);
				}.bind(this));
		},

		onCreateLabelDialogCancelPress: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onOpenPalletsCalculatorPress: function () {
			var oDialog = this.getFragment("PalletsCalculatorDialog", this);
			oDialog.open();
			this._getPallets().then(function (aPallets) {
				oDialog.getContent()[0].setInitialLines(aPallets);
			});

		},

		onPalletDelete: function (oEvent) {
			var sCaseNumber = oEvent.getParameter("key");
			var oPallet = this._parsePalletScan(sCaseNumber);
			this.deletePallet(oPallet);
		},

		onCalculatorOkPress: function () {
			var oDialog = this.getFragment("PalletsCalculatorDialog", this);
			oDialog.close();
			var oCalculator = oDialog.getContent()[0];
			var aPallets = oCalculator.getNewResultLines();
			this._createPallets(aPallets);
			
			var iResult = oCalculator.getResult();
			this.setDeliveryProperty("ActualQuantity", iResult.toString());
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_createPallets: function (aPallets) {
			aPallets.forEach(function (oPallet) {
				this._createPallet({
					Quantity: oPallet.toString(),
					DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
					ItemKey: this.getDeliveryProperty("ItemKey"),
					PalletNumber: ""
				});
			}, this);
		},

		_createPallet: function (oPallet) {
			var oModel = this.getView().getModel();
			return new Promise(function (resolve, reject) {
				oModel.create("/PalletSet", oPallet, {
					success: resolve,
					error: reject
				});
			});
		},

		deletePallet: function (oPallet) {
			var oModel = this.getView().getModel();
			var sPath = oModel.createKey("/PalletSet", {
				DeliveryKey: oPallet.DeliveryKey,
				ItemKey: oPallet.ItemKey,
				PalletNumber: oPallet.PalletNumber
			});
			return new Promise(function (resolve, reject) {
				oModel.remove(sPath, {
					success: resolve,
					error: reject
				});
			});
		},

		_getPallets: function () {
			return new Promise(function (resolve, reject) {
				this.getView().getModel().read("/PalletSet", {
					filters: [
						new sap.ui.model.Filter("DeliveryKey", "EQ", this.getDeliveryProperty("DeliveryKey")),
						new sap.ui.model.Filter("ItemKey", "EQ", this.getDeliveryProperty("ItemKey")),
						new sap.ui.model.Filter("Status", "EQ", "NEW")
					],
					success: function (oData) {
						resolve(oData.results);
					},
					error: reject
				});
			}.bind(this));
		},

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
			case hppm.INSPECTION_STATUS.OPEN:
				this.setDeliveryProperty("InspectionStatus", "QUALITY");
				break;
			case hppm.INSPECTION_STATUS.QUALITY:
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