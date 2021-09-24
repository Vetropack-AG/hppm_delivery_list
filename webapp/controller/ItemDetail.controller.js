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
			this._setModels();
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

				setTimeout(function () { // eslint-disable-line
					this._triggerQuantityCalculation();
				}.bind(this), 1000);

			}.bind(this));
		},

		onConfirmPress: function () {
			this.setDeliveryProperty("DoConfirm", true);
			this._saveItem();
		},

		onCancelPress: function () {
			this.getView().getModel().resetChanges();
		},

		onSavePress: function () {
			this._saveItem();
		},

		onSapPostingPress: function () {
			this.getView().getModel("ViewSettings").setProperty("/ManualPosting", false);
			this.getView().getModel("ViewSettings").setProperty("/MaterialDocument", undefined);
			this.getFragment("PostItemDialog", this).open();
		},

		onPostItemDialogSavePress: function (oEvent) {
			this._handleFinalPosting();
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
					this.getView().getModel("ViewSettings").setProperty("/ItemPrinted", true);
				}.bind(this));
		},

		onCreateLabelDialogCancelPress: function (oEvent) {
			oEvent.getSource().getParent().close();
		},

		onOpenPalletsCalculatorPress: function () {
			var sMaterialGroup = this.getView().byId("material").getSelectedItem().getBindingContext().getProperty("MaterialGroup");
			var sMaterial = this.getView().byId("material").getSelectedItem().getBindingContext().getProperty("Key");
			this._openCalculator(sMaterialGroup, sMaterial);
		},

		onLayersCalculatorOkPress: function (oEvent) {
			oEvent.getSource().getParent().close();
			var iResult = this.getView().getModel("ViewSettings").getProperty("/LayerResult");
			this.setDeliveryProperty("ActualQuantity", iResult.toString());
			this._triggerQuantityCalculation(iResult);
			this.getView().getModel().submitChanges();
		},

		onPalletsCalculatorOkPress: function (oEvent) {
			oEvent.getSource().getParent().close();
			var iSum = this.getView().getModel("ViewSettings").getProperty("/PalletResult");
			var oModel = this.getView().getModel();
			var oChanges = oModel.getPendingChanges();
			for (var sPath in oChanges) {
				if (oChanges.hasOwnProperty(sPath) && sPath.indexOf("PalletCalculatorSet") !== -1) {
					oModel.setProperty("/" + sPath + "/PalletResult", iSum);
				}
			}
			this.setDeliveryProperty("ActualQuantity", iSum.toString());
			this._triggerQuantityCalculation(iSum);
			oModel.submitChanges();
		},

		onLayerResultChange: function () {
			var iSum = 0;
			var oDialog = this.getFragment("LayersCalculatorDialog", this);
			var oTable = oDialog.getContent()[0];
			var aItems = oTable.getItems();
			aItems.forEach(function (oItem) {
				var oCell = oItem.getCells()[4];
				var sValue = oCell.getText();
				var iValue = parseInt(sValue, 10);
				if (!isNaN(iValue)) {
					iSum = iSum + iValue;
				}
			}, this);
			this.getView().getModel("ViewSettings").setProperty("/LayerResult", iSum);
		},

		onLayersCalculatorModeChange: function () {

		},

		onPalletResultChange: function () {
			var iSum = 0;
			var oDialog = this.getFragment("PalletsCalculatorDialog", this);
			var oTable = oDialog.getContent()[0];
			var aItems = oTable.getItems();
			aItems.forEach(function (oItem) {
				var oCell = oItem.getCells()[6];
				var sValue = oCell.getText();
				var iValue = parseInt(sValue, 10);
				if (!isNaN(iValue)) {
					iSum = iSum + iValue;
				}
			}, this);
			this.getView().getModel("ViewSettings").setProperty("/PalletResult", iSum);
		},

		onLayerItemDelete: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			var oContext = oItem.getBindingContext();
			var sCalcKey = oContext.getProperty("CalculatorKey");
			this._deleteItem(oItem)
				.then(function () {
					this._deletePalletsAfterItemDelete(sCalcKey);
				}.bind(this));
		},

		onPalletItemDelete: function (oEvent) {
			var oItem = oEvent.getParameter("listItem");
			this._deleteItem(oItem)
				.then(this._updatePalletsQuantityAfterDelete.bind(this));
		},

		onAddLayerPress: function () {
			var oModel = this.getView().getModel();
			var oDialog = this.getFragment("LayersCalculatorDialog", this);
			oModel.create("/PalletCalculatorSet", {
				DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
				ItemKey: this.getDeliveryProperty("ItemKey")
			}, {
				refreshAfterChange: true
			});

			var oCalculator = oDialog.getContent()[0];
			oCalculator.getBinding("items").refresh(true);
		},

		onAddPalletPress: function () {
			var oModel = this.getView().getModel();
			var oDialog = this.getFragment("PalletsCalculatorDialog", this);
			oModel.create("/PalletCalculatorSet", {
				DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
				ItemKey: this.getDeliveryProperty("ItemKey")
			}, {
				refreshAfterChange: true
			});

			var oCalculator = oDialog.getContent()[0];
			oCalculator.getBinding("items").refresh(true);
		},

		onPalletDelete: function (oEvent) {
			var sCaseNumber = oEvent.getParameter("key");
			var oPallet = this._parsePalletScan(sCaseNumber);
			this.deletePallet(oPallet);
		},

		onPrePostingPress: function () {
			this._handlePrePosting();
		},

		onMaterialChange: function (oEvent) {
			var oItem = oEvent.getParameter("selectedItem");
			if (oItem) {
				this._saveItem();
			}
		},

		onNoRepairChange: function () {
			this.setDeliveryProperty("NeedRepairQuantity", "0");
			this._triggerQuantityCalculation();
		},

		onNoScrapChange: function () {
			this.setDeliveryProperty("NeedScrapQuantity", "0");
			this._triggerQuantityCalculation();
		},

		/* =========================================================== */
		/* private methods                                             */
		/* =========================================================== */

		_preSelectMaxReturn: function () {
			var sCustomer = this.getView().getModel("Header").getProperty("/SoldToParty");
			this.getMaxReturnDelivery(sCustomer)
				.then(this._setMaxReturnDelivery.bind(this));
		},

		_setMaxReturnDelivery: function (iValue) {
			this.getView().getModel("ViewSettings").setProperty("/MaxReturn", iValue.toString() || "");
		},

		_triggerQuantityCalculation: function (value) {
			this.getView().byId("ActualQuantityInput").fireChange({
				value: value
			});
		},

		_saveItem: function () {
			return new Promise(function (resolve, reject) {
				var oModel = this.getView().getModel();
				if (oModel.hasPendingChanges()) {
					sap.ui.core.BusyIndicator.show(0);
					oModel.submitChanges({
						success: function (oData) {
							if (!this.isSubmitError(oData)) {
								sap.ui.core.BusyIndicator.hide();
								this.showTranslatedMessageToast("message.itemSaved", [this.getDeliveryProperty("ItemKey")]);
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

		_setModels: function () {
			this.getView().setModel(new sap.ui.model.json.JSONModel({
				LayersCalculatorMode: "PIECES",
				ItemPrinted: false,
				ManualPosting: false
			}), "ViewSettings");
			this.getView().setModel(new sap.ui.model.json.JSONModel(), "Header");
		},

		_prefillMaterialHeight: function (sMaterial) {
			this._getMaterialHeight(sMaterial)
				.then(this._setMaterialHeight.bind(this));
		},

		_getMaterialHeight: function (sMaterial) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/MaterialSet", {
				MaterialNumber: sMaterial
			});
			return new Promise(function (resolve, reject) {
				oModel.read(sPath, {
					success: function (oData) {
						resolve(oData.Height);
					},
					error: reject
				});
			});
		},

		_setMaterialHeight: function (sValue) {
			this.getView().getModel("ViewSettings").setProperty("/LayerHeight", sValue);
		},

		_deletePalletsAfterItemDelete: function (sCalcKey) {
			var oModel = this.getView().getModel();
			oModel.read("/PalletSet", {
				filters: [
					new sap.ui.model.Filter("CalculatorKey", "EQ", sCalcKey)
				],
				success: function (oResponse) {
					oResponse.results.forEach(function (oPallet) {
						this.deletePallet(oPallet);
					}, this);
				}.bind(this)
			});
		},

		_updatePalletsQuantityAfterDelete: function () {
			var oDialog = this.getFragment("PalletsCalculatorDialog", this);
			var iSum = this.getView().getModel("ViewSettings").getProperty("/PalletResult");
			var oModel = this.getView().getModel();
			var oTable = oDialog.getContent()[0];
			var aItems = oTable.getItems();
			aItems.forEach(function (oItem) {
				var oContext = oItem.getBindingContext();
				if (oModel.getProperty(oContext.getPath())) {
					oModel.setProperty(oContext.getPath() + "/PalletResult", iSum);
				}
			}, this);
			oModel.submitChanges();
		},

		_deleteItem: function (oItem) {
			var oModel = this.getView().getModel();
			var sKey = oModel.createKey("/PalletCalculatorSet", {
				DeliveryKey: oItem.getBindingContext().getProperty("DeliveryKey"),
				ItemKey: oItem.getBindingContext().getProperty("ItemKey"),
				Counter: oItem.getBindingContext().getProperty("Counter")
			});
			return new Promise(function (resolve, reject) {
				oModel.remove(sKey, {
					success: function () {
						oModel.refresh(true);
						resolve();
					},
					error: reject
				});
			});
		},

		_openCalculator: function (sMaterialGroup, sMaterial) {
			var sId = this._determineCalculatorFragment(sMaterialGroup);
			if (sId) {
				if (sMaterialGroup === hppm.MATERIAL_GROUP.LAYER) {
					this._prefillMaterialHeight(sMaterial);
				}
				var oDialog = this.getFragment(sId, this);
				var oCalculator = oDialog.getContent()[0];
				var aFilters = [
					new sap.ui.model.Filter("DeliveryKey", "EQ", this.getDeliveryProperty("DeliveryKey")),
					new sap.ui.model.Filter("ItemKey", "EQ", this.getDeliveryProperty("ItemKey"))
				];
				oCalculator.getBinding("items").filter(aFilters, "Application");
				oDialog.open();
			}
		},

		_determineCalculatorFragment: function (sMaterialGroup) {
			if (!sMaterialGroup) {
				return undefined;
			}
			if (sMaterialGroup.indexOf("PALLE") !== -1) {
				return "PalletsCalculatorDialog";
			} else if (sMaterialGroup.indexOf("LAYER") !== -1) {
				return "LayersCalculatorDialog";
			}
			return undefined;
		},

		_createPallets: function (aPallets) {
			aPallets.forEach(function (oPallet) {
				this._createPallet({
					Quantity: oPallet.Quantity,
					DeliveryKey: oPallet.DeliveryKey,
					ItemKey: oPallet.ItemKey,
					PalletNumber: "",
					Original: true,
					CalculatorKey: oPallet.CalculatorKey
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

		_handleFinalPosting: function () {
			this._saveItem().then(function () {
				this.doFinalPosting({
					DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
					ItemKey: this.getDeliveryProperty("ItemKey"),
					MaterialDocument: this.getView().getModel("ViewSettings").getProperty("/MaterialDocument") || "",
					ManualPosting: this.getView().getModel("ViewSettings").getProperty("/ManualPosting") || false,
					MaxReturn: this.getView().getModel("ViewSettings").getProperty("/MaxReturn")
				}).then(this._showItemPosted.bind(this));
			}.bind(this));
		},

		_handlePrePosting: function () {
			this._saveItem().then(function () {
				this.doPrePosting({
					DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
					ItemKey: this.getDeliveryProperty("ItemKey")
				}).then(this._showItemPosted.bind(this));
			}.bind(this));
		},

		_showItemPosted: function () {
			var oDialog = this.getFragment("PostItemDialog", this);
			oDialog.close();
			this.showTranslatedMessageToast("message.itemPosted", [this.getDeliveryProperty("ItemKey")]);
		},

		_bindView: function (sDeliveryKey, sItemKey) {
			var oModel = this.getOwnerComponent().getModel();
			var sPath = oModel.createKey("/DeliveryItemSet", {
				DeliveryKey: sDeliveryKey,
				ItemKey: sItemKey
			});
			this.getView().bindElement(sPath);

			sPath = oModel.createKey("/DeliveryHeadSet", {
				DeliveryKey: sDeliveryKey
			});
			this.getView().getModel().read(sPath, {
				success: this._bindHeaderData.bind(this)
			});
		},

		_bindHeaderData: function (oData) {
			this.getView().getModel("Header").setProperty("/", oData);
			this._setFooterButtonVisibilities(oData);
			this._preSelectMaxReturn();
		},

		_setFooterButtonVisibilities: function (oData) {
			var oModel = this.getView().getModel("ViewSettings");
			oModel.setProperty("/SapPostingVisible", oData.DeliveryType === "ZRET");
		}

	});

});