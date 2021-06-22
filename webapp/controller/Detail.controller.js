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
				LastScannedPallets: [],
				NewItemQuantity: 1
			}), "ViewSettings");
		},

		/* =========================================================== */
		/* event handlers                                              */
		/* =========================================================== */

		onPalletSearch: function (oEvent) {
			var sQuery = oEvent.getParameter("query");

			if (this._isPalletScan(sQuery)) {
				this._handlePalletScan(sQuery);
			} else {
				this._handleMaterialScan(sQuery);
			}

			this._addToLastScannedPallets(sQuery);
			oEvent.getSource().setValue("");
		},

		onAddItemPress: function () {
			this.getFragment("AddItemDialog", this).open();
		},

		onAddItemDialogSavePress: function (oEvent) {
			oEvent.getSource().getParent().close();
			this._createItemFromMaterial();
		},

		onAddItemDialogClosePress: function (oEvent) {
			oEvent.getSource().getParent().close();
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
					var oContext = oItem.getBindingContext();
					this._navToDetail(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
				} else if (sDeliveryType === hppm.DELIVERY_TYPE.INTERNAL) {
					this._handleInternalDeliveryNavigation();
				}
			}.bind(this));
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

		_handleMaterialScan: function (sMaterial) {
			this._getMaterial(sMaterial)
				.then(this._showCreateItemFromMaterialMessage.bind(this));
		},

		_showCreateItemFromMaterialMessage: function (oReponse) {
			this.getView().getModel("ViewSettings").setProperty("/NewItemMaterial", oReponse.MaterialNumber);
			this.getFragment("AddItemDialog", this).open();
		},

		_createItemFromMaterial: function () {
			this.getView().getModel().createEntry("/DeliveryItemSet", {
				properties: {
					DeliveryKey: this.getView().getBindingContext().getProperty("DeliveryKey"),
					MaterialNumber: this.getView().getModel("ViewSettings").getProperty("/NewItemMaterial"),
					Quantity: this.getView().getModel("ViewSettings").getProperty("/NewItemQuantity").toString()
				}
			});
			this._submitItem();
		},

		_submitItem: function () {
			this.getView().getModel().submitChanges({
				success: function (oData) {
					if (!this.isSubmitError(oData)) {
						this.showTranslatedMessageToast("message.itemAdded");
						this.getView().getModel().refresh(true);

						var sDeliveryKey = oData.__batchResponses[0].__changeResponses[0].data.DeliveryKey;
						var sItemKey = oData.__batchResponses[0].__changeResponses[0].data.ItemKey;

						setTimeout(function () { // eslint-disable-line
							this._navToDetail(sDeliveryKey, sItemKey);
						}.bind(this), 500);
					} else {
						this.getView().getModel().resetChanges();
					}
				}.bind(this)
			});
		},

		_getMaterial: function (sMaterial) {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				var sKey = oModel.createKey("/MaterialSet", {
					MaterialNumber: sMaterial
				});
				oModel.read(sKey, {
					success: resolve,
					error: reject
				});
			}.bind(this));
		},

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

		_navToDetail: function (sDeliveryKey, sItemKey) {
			this.navTo("ItemDetail", {
				DeliveryKey: sDeliveryKey,
				ItemKey: sItemKey
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
			this._checkAllItemsHavePallets(sDeliveryKey)
				.then(this._setSapPostingEnabled.bind(this));
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
				type: "Active",
				icon: "{= ${HasPallets} === false ? 'sap-icon://alert' : '' }",
				iconInset: false
			});
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: oTemplate,
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		},

		_checkAllItemsHavePallets: function (sDeliveryKey) {
			return new Promise(function (resolve, reject) {
				var oModel = this.getOwnerComponent().getModel();
				oModel.read("/DeliveryItemSet", {
					filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)],
					success: function (oData) {
						var bResult = oData.results.every(function (oItem) {
							return oItem.HasPallets === true;
						});
						resolve(bResult);
					},
					error: reject
				});
			}.bind(this));
		},

		_setSapPostingEnabled: function (bValue) {
			this.getView().byId("SapPostingButton").setEnabled(bValue);
		}

	});

});