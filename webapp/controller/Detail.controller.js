sap.ui.define([
	"zvgt/hppm/delivery_list/controller/BaseController",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"zvgt/hppm/delivery_list/model/formatter",
	"zvgt/hppm/library",
	"zvgt/hppm/delivery_list/model/quantityCalculator",
	"zvgt/hppm/delivery_list/model/models"
], function (BaseController, Filter, FilterOperator, formatter, hppm, quantityCalculator, models) {
	"use strict";

	return BaseController.extend("zvgt.hppm.delivery_list.controller.Detail", {
		formatter: formatter,
		quantityCalculator: quantityCalculator,

		/* =========================================================== */
		/* lifecycle methods                                           */
		/* =========================================================== */

		onInit: function () {
			this.getOwnerComponent().getRouter().getRoute("Detail").attachPatternMatched(this.onRoutePatternMatched, this);
			this.getView().setModel(new sap.ui.model.json.JSONModel({
				LastScannedPallets: []
			}), "ViewSettings");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onPalletSearch: function (oEvent) {
			var sQuery = oEvent.getParameter("query");
			this._handlePalletScan(sQuery);
			this._addToLastScannedPallets(sQuery);
			oEvent.getSource().setValue("");
		},

		onPalletSuggest: function (oEvent) {
			oEvent.getSource().suggest();
		},

		onRoutePatternMatched: function (oEvent) {
			var sDeliveryKey = oEvent.getParameter("arguments").DeliveryKey;
			this.getOwnerComponent().getModel().metadataLoaded(true).then(function () {
				this._bindView(sDeliveryKey);
			}.bind(this));
		},

		onDetailItemPress: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			this._getDeliveryType().then(function (sDeliveryType) {
				if (sDeliveryType === hppm.DELIVERY_TYPE.EXTERNAL) {
					this._navToDetail(oItem);
				} else if (sDeliveryType === hppm.DELIVERY_TYPE.INTERNAL) {
					this._handleInternalDeliveryNavigation();
				}
			}.bind(this));
		},

		onAddItemPress: function () {
			var oDialog = this.getFragment("AddDetailDialog", this);
			var oContext = this.getView().getModel().createEntry("/DeliveryItemSet", {
				properties: {
					DeliveryKey: this.getView().getBindingContext().getProperty("DeliveryKey"),
					Quantity: "1"
				}
			});
			oDialog.setBindingContext(oContext);
			oDialog.open();
		},

		onAddItemDialogSavePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			oDialog.setBusy(true);
			this.getView().getModel().submitChanges({
				success: function (oData) {
					if (!this.isSubmitError(oData)) {
						oDialog.setBusy(false);
						oDialog.close();
						this.showTranslatedMessageToast("message.itemAdded");
						this.getView().getModel().refresh(true);
					} else {
						this.getView().getModel().resetChanges();
					}
				}.bind(this),
				error: function () {
					oDialog.setBusy(false);
				}
			});
		},

		onAddItemDialogClosePress: function (oEvent) {
			var oDialog = oEvent.getSource().getParent();
			var oContext = oDialog.getBindingContext();
			this.getView().getModel().deleteCreatedEntry(oContext);
			oDialog.close();
		},

		onSapPostingPress: function () {
			this._bindPostItemsDialog();
			this.getFragment("PostItemsDialog", this).open();
		},

		onPostItemsDialogSavePress: function (oEvent) {
			var oDialog = this.getFragment("PostItemsDialog", this);
			oDialog.close();
			var oList = oDialog.getContent()[0];
			oList.getItems()
				.map(this._mapListItemToGoodsMovementItemData, this)
				.forEach(this._handlePostGoodsMovement, this);
		},

		onPostItemsCancelSavePress: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onAddCommentPress: function () {
			this.getFragment("AddCommentDialog", this).open();
		},

		onAddCommentDialogSavePress: function (oEvent) {
			this.getView().getModel().submitChanges();
		},

		onAddCommentDialogClosePress: function (oEvent) {
			oEvent.getSource().getParent().close();
			this.getView().getModel().resetChanges();
		},

		onLoadPress: function () {
			this._navToLoadPalletsApp();
		},

		onUnloadPress: function () {
			this._navToUnloadPalletsApp();
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_handlePalletScan: function (sScan) {
			var oPallet = this._parsePalletScan(sScan);
			this._setNextPalletStatus(oPallet).then(this._showPalletStatusSuccessMessage.bind(this));
		},

		_showPalletStatusSuccessMessage: function (oData) {
			this.showTranslatedMessageToast("message.palletStatusSet", [oData.CaseNumber, oData.Status]);
			this.getView().getModel().refresh(true);
		},

		_setNextPalletStatus: function (oPallet) {
			return new Promise(function (resolve, reject) {
				this._getDeliveryItemStatus(oPallet.DeliveryKey, oPallet.ItemKey).then(function (sCurrentStatus) {
					var oModel = this.getView().getModel();
					oModel.callFunction("/SetPalletStatus", {
						urlParameters: {
							DeliveryKey: oPallet.DeliveryKey,
							ItemKey: oPallet.ItemKey,
							PalletNumber: oPallet.PalletNumber,
							Status: this._getNextPalletStatus(sCurrentStatus)
						},
						success: resolve,
						error: reject
					});
				}.bind(this));
			}.bind(this));
		},

		_getNextPalletStatus: function (sCurrentStatus) {
			switch (sCurrentStatus) {
			case hppm.INSPECTION_STATUS.QUALITY:
				return hppm.INSPECTION_STATUS.LOADED;
			case hppm.INSPECTION_STATUS.QUANTITY:
				return hppm.INSPECTION_STATUS.UNLOADED;
			case hppm.INSPECTION_STATUS.LOADED:
				return hppm.INSPECTION_STATUS.UNLOADED;
			default:
				throw new Error("Status invalid");
			}
		},

		_addToLastScannedPallets: function (sQuery) {
			var aLastScanned = this.getView().getModel("ViewSettings").getProperty("/LastScannedPallets");
			if (aLastScanned.findIndex(function (oScan) {
					return oScan.Scan === sQuery;
				}) === -1) {
				aLastScanned.unshift({
					Scan: sQuery
				});
			}
			this.getView().getModel("ViewSettings").setProperty("/LastScannedPallets", aLastScanned);
		},

		_handleInternalDeliveryNavigation: function () {
			var sStatus = this.getView().getBindingContext().getProperty("InspectionStatus");
			if (sStatus === hppm.INSPECTION_STATUS.OPEN) {
				this._navToLoadPalletsApp();
			} else if (sStatus === hppm.INSPECTION_STATUS.LOADED) {
				this._navToUnloadPalletsApp();
			}
		},

		_getDeliveryType: function () {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				var sKey = oModel.createKey("/DeliveryHeadSet", {
					DeliveryKey: this.getView().getBindingContext().getProperty("DeliveryKey")
				});
				oModel.read(sKey, {
					success: function (oData) {
						resolve(oData.DeliveryType);
					},
					error: reject
				});
			}.bind(this));
		},

		_getDeliveryItemStatus: function (sDeliveryKey, sItemKey) {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				var sKey = oModel.createKey("/DeliveryItemSet", {
					DeliveryKey: sDeliveryKey,
					ItemKey: sItemKey
				});
				oModel.read(sKey, {
					success: function (oData) {
						resolve(oData.InspectionStatus);
					},
					error: reject
				});
			}.bind(this));
		},

		_navToLoadPalletsApp: function () {
			var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (oCrossAppNav && this._getSelectedDeliveryItem()) {
				oCrossAppNav.toExternal({ // eslint-disable-line
					target: {
						semanticObject: "Pallet",
						action: "load"
					},
					params: {
						DeliveryKey: this._getSelectedDeliveryItem().DeliveryKey,
						ItemKey: this._getSelectedDeliveryItem().ItemKey
					}
				});
			}
		},

		_navToUnloadPalletsApp: function () {
			var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (oCrossAppNav && this._getSelectedDeliveryItem()) {
				oCrossAppNav.toExternal({ // eslint-disable-line
					target: {
						semanticObject: "Pallet",
						action: "unload"
					},
					params: {
						DeliveryKey: this._getSelectedDeliveryItem().DeliveryKey,
						ItemKey: this._getSelectedDeliveryItem().ItemKey
					}
				});
			}
		},

		_navToDetail: function (oItem) {
			var oContext = oItem.getBindingContext();
			this.navTo("ItemDetail", {
				DeliveryKey: oContext.getProperty("DeliveryKey"),
				ItemKey: oContext.getProperty("ItemKey")
			});
		},

		_getSelectedDeliveryItem: function () {
			var oList = this.getView().byId("ItemList");
			var oItem = oList.getSelectedItem();
			if (oItem) {
				return oItem.getBindingContext().getModel().getProperty(oItem.getBindingContext().getPath() + "/");
			}
			return undefined;
		},

		_handlePostGoodsMovement: function (oItem) {
			this.postGoodsMovement(oItem)
				.then(this._showItemsPosted.bind(this));
		},

		_mapListItemToGoodsMovementItemData: function (oListItem) {
			return {
				Quantity: oListItem.getContent()[0].getValue().toString(),
				ItemKey: oListItem.getCustomData()[0].getValue(),
				DeliveryKey: this.getDeliveryProperty("DeliveryKey")
			};
		},

		_bindPostItemsDialog: function () {
			var oList = this.getFragment("PostItemsDialog", this).getContent()[0];
			var sDeliveryKey = this.getDeliveryProperty("DeliveryKey");
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: this._createPostItemsDialogTemplate(),
				filters: [
					new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey),
					new Filter("InspectionStatus", FilterOperator.NE, hppm.INSPECTION_STATUS.POSTED)
				]
			});
		},

		_createPostItemsDialogTemplate: function () {
			return new sap.m.InputListItem({
				label: "{ItemKey} - {ItemText} / {MaterialNumber} - {MaterialText}",
				content: new sap.m.StepInput({
					min: 1,
					width: "8rem"
				}),
				customData: new sap.ui.core.CustomData({
					key: "ItemKey",
					value: "{ItemKey}"
				})
			});
		},

		_showItemsPosted: function (oData) {
			this.getView().getModel().refresh(true);
			this.showTranslatedMessageToast("message.itemPosted", [oData.ItemKey]);
		},

		_getCurrentDeliveryKey: function () {
			var oContext = this.getView().getBindingContext();
			return oContext.getProperty("DeliveryKey");
		},

		_bindView: function (sDeliveryKey) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/DeliveryHeadSet", {
				DeliveryKey: sDeliveryKey
			});
			this.getView().bindElement(sPath);
			this.getView().getModel().refresh(true);

			this._bindItemList(sDeliveryKey);
		},

		_bindItemList: function (sDeliveryKey) {
			var oList = this.getView().byId("ItemList");
			var oTemplate = new sap.m.StandardListItem({
				title: "{ItemKey} - {ItemText}",
				description: "{MaterialNumber} - {MaterialText}",
				info: "{InspectionStatusText}",
				infoState: {
					path: "InspectionStatus",
					formatter: formatter.itemInspectionStatusState
				},
				type: "Active"
			});
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: oTemplate,
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		}

	});

});