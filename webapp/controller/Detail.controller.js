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

		onDeleteItemPress: function () {
			this._deleteItem().then(function () {
				this.getView().getModel().refresh(true);
			}.bind(this));
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
			var oContext = oItem.getBindingContext();
			if (oItem.getHighlight() === "Error") {
				this._navToDetail(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
				return;
			}
			this._getDeliveryType().then(function (sDeliveryType) {
				if (sDeliveryType === hppm.DELIVERY_TYPE.EXTERNAL) {
					this._navToDetail(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
				} else if (sDeliveryType === hppm.DELIVERY_TYPE.INTERNAL) {
					this._handleInternalDeliveryNavigation(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
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
			var oList = this._getPostItemsList();

			this._saveItems().then(function () {
				oList.getItems()
					.map(this._mapListItemToGoodsMovementItemData, this)
					.forEach(this._handleFinalPosting, this);
			}.bind(this));
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

		_getPostItemsList: function () {
			return this.getFragment("PostItemsDialog", this).getContent()[1];
		},

		_saveItems: function () {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				if (oModel.hasPendingChanges()) {
					sap.ui.core.BusyIndicator.show(0);
					oModel.submitChanges({
						success: function (oData) {
							if (!this.isSubmitError(oData)) {
								sap.ui.core.BusyIndicator.hide();
								resolve();
							} else {
								this.getView().getModel().resetChanges();
								reject();
							}
						}.bind(this),
						error: reject
					});
				} else {
					resolve();
				}
			}.bind(this));
		},

		_handleFinalPosting: function (oData) {
			this.doFinalPosting({
				DeliveryKey: oData.DeliveryKey,
				ItemKey: oData.ItemKey,
				MaxReturn: oData.MaxReturn
			}).then(this._showItemsPosted.bind(this));
		},

		_preSelectMaxReturn: function () {
			setTimeout(function () { // eslint-disable-line
				var sCustomer = this.getDeliveryProperty("SoldToParty");
				this.getMaxReturnDelivery(sCustomer)
					.then(this._setMaxReturnDelivery.bind(this));
			}.bind(this), 2500);

		},

		_setMaxReturnDelivery: function (iValue) {
			this._iMaxReturn = iValue;
		},

		_deleteItem: function () {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				var sKey = oModel.createKey("/DeliveryItemSet", {
					DeliveryKey: this._getSelectedDeliveryItem().DeliveryKey,
					ItemKey: this._getSelectedDeliveryItem().ItemKey
				});
				oModel.remove(sKey, {
					success: resolve,
					error: reject
				});
			}.bind(this));
		},

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

		_handleInternalDeliveryNavigation: function (sDeliveryKey, sItemKey) {
			var sStatus = this.getView().getBindingContext().getProperty("InspectionStatus");
			if (sStatus === hppm.INSPECTION_STATUS.OPEN) {
				this._navToLoadPalletsApp(sDeliveryKey, sItemKey);
			} else if (sStatus === hppm.INSPECTION_STATUS.LOADED) {
				this._navToUnloadPalletsApp(sDeliveryKey, sItemKey);
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

		_navToLoadPalletsApp: function (sDeliveryKey, sItemKey) {
			var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
			if (!sDeliveryKey) {
				sDeliveryKey = this._getSelectedDeliveryItem().DeliveryKey; // eslint-disable-line
			}
			if (!sItemKey) {
				sItemKey = this._getSelectedDeliveryItem().ItemKey; // eslint-disable-line
			}
			if (oCrossAppNav && sDeliveryKey && sItemKey) {
				oCrossAppNav.toExternal({ // eslint-disable-line
					target: {
						semanticObject: "Pallet",
						action: "load"
					},
					params: {
						DeliveryKey: sDeliveryKey,
						ItemKey: sItemKey
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

		_mapListItemToGoodsMovementItemData: function (oListItem) {
			return {
				Quantity: oListItem.getContent()[0].getItems()[0].getValue().toString(),
				ItemKey: oListItem.getCustomData()[0].getValue(),
				DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
				MaxReturn: oListItem.getContent()[0].getItems()[1].getValue().toString()
			};
		},

		_bindPostItemsDialog: function () {
			var oList = this._getPostItemsList();
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
			return new sap.m.ColumnListItem({
				cells: [
					new sap.m.Text({
						text: "{MaterialNumber}"
					}),
					new sap.m.Text({
						text: "{MaterialText}"
					}),
					new sap.m.StepInput({
						min: 1,
						width: "8rem",
						value: "{ path:'QtyPosted', type:'sap.ui.model.odata.type.Decimal' }"
					}),
					new sap.m.StepInput({
						min: 1,
						width: "8rem",
						value: this._iMaxReturn || 31
					})
				],
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
			this._preSelectMaxReturn();
		},

		_bindItemList: function (sDeliveryKey) {
			var oList = this.getView().byId("ItemList");
			oList.bindAggregation("items", {
				path: "/DeliveryItemSet",
				template: this._getItemTemplate(),
				filters: [new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey)]
			});
		},

		_getItemTemplate: function () {
			return new sap.m.CustomListItem({
				type: "Active",
				highlight: "{= ${HasPallets} === false ? 'Error' : 'None' }",
				content: [
					new sap.m.HBox({
						alignItems: "Start",
						justifyContent: "SpaceBetween",
						items: [
							new sap.m.VBox({
								items: [
									new sap.m.Title({
										text: "{ItemKey} - {ItemText}"
									}),
									new sap.m.Text({
										text: "{MaterialNumber} - {MaterialText}"
									})
								]
							}).addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginTopBottom"),
							new sap.m.VBox({
								items: [
									new sap.m.ObjectStatus({
										text: "{InspectionStatusText}",
										state: {
											path: "InspectionStatus",
											formatter: formatter.itemInspectionStatusState
										}
									}).addStyleClass("sapUiTinyMarginTopBottom"),
									new sap.m.ObjectStatus({
										text: "{i18n>details.quantityResult}",
										icon: "{= ${QuantityResult} === true ? 'sap-icon://sys-enter-2' : 'sap-icon://message-error' }",
										state: "{= ${QuantityResult} === true ? 'Success' : 'Error' }",
										visible: "{= ${InspectionStatus} === 'QUANTITY' || ${InspectionStatus} === 'QUALITY' || ${InspectionStatus} === 'POSTED' || ${InspectionStatus} === 'COMPLETED' }"
									}),
									new sap.m.ObjectStatus({
										text: "{i18n>details.qualityResult}",
										icon: "{= ${QualityResult} === true ? 'sap-icon://sys-enter-2' : 'sap-icon://message-error' }",
										state: "{= ${QualityResult} === true ? 'Success' : 'Error' }",
										visible: "{= ${InspectionStatus} === 'QUALITY' || ${InspectionStatus} === 'POSTED' || ${InspectionStatus} === 'COMPLETED' }"
									})
								]
							}).addStyleClass("sapUiSmallMarginBegin sapUiSmallMarginEnd")
						]

					})
				]
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