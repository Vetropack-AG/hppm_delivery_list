sap.ui.define([
    "zvgt/hppm/delivery/list/controller/BaseController",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "zvgt/hppm/delivery/list/model/formatter",
    "zvgt/hppm/delivery/list/model/quantityCalculator",
    "zvgt/hppm/delivery/list/model/models"
    
], function (BaseController, Filter, FilterOperator, formatter, quantityCalculator, models) {
    "use strict";

    var BATCH_GROUP_CONFIRM_LOADING = "confirmLoading";
    var BATCH_GROUP_CONFIRM_UNLOADING = "confirmUnloading";

    return BaseController.extend("zvgt.hppm.delivery.list.controller.Detail", {
        formatter: formatter,
        quantityCalculator: quantityCalculator,

        /* =========================================================== */
        /* lifecycle methods                                           */
        /* =========================================================== */

        onInit: function () {
            this.getView().setModel(new sap.ui.model.json.JSONModel({
                LastScannedPallets: [],
                NewItemQuantity: 1
            }), "ViewSettings");
            this.getView().setModel(new sap.ui.model.json.JSONModel(), "Header");

            this.getOwnerComponent().getRouter().getRoute("Detail").attachPatternMatched(this.onRoutePatternMatched, this);
            
            this._initializePDFViewer();
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
            var oSelectedItem = this._getSelectedDeliveryItem();
            if (oSelectedItem.InspectionStatus === zvgt.hppm.INSPECTION_STATUS.COMPLETED) {
                this.showTranslatedErrorMessage("message.itemCannotBeDeleted");
                return;
            }

            this._deleteSelectedItem().then(function () {
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
                if (sDeliveryType === zvgt.hppm.DELIVERY_TYPE.EXTERNAL) {
                    this._navToDetail(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
                } else if (sDeliveryType === zvgt.hppm.DELIVERY_TYPE.INTERNAL) {
                    this._handleInternalDeliveryNavigation(oContext.getProperty("DeliveryKey"), oContext.getProperty("ItemKey"));
                }
            }.bind(this));
        },

        onSapPostingPress: function () {
            this._bindPostItemsDialog();
            this.getFragment("PostItemsDialog", this).open();
        },

        onPostItemsDialogSavePress: function (oEvent) {
            this.getFragment("PostItemsDialog", this).close();
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

        onConfirmLoadingPress: function () {
            this._confirmLoading()
                .then(this._handleConfirmLoadingSuccess.bind(this));
        },

        onConfirmUnloadingPress: function () {
            this._confirmUnloading()
                .then(this._handleConfirmUnloadingSuccess.bind(this));
        },

        onOpenInternalClaimPress: function () {
            this._openClaim("INTERNAL");
        },

        onOpenExternalClaimPress: function () {
            this._openClaim("EXTERNAL");
        },

        onCloseInternalClaimPress: function () {
            this._closeClaim("INTERNAL");
        },

        onCloseExternalClaimPress: function () {
            this._closeClaim("EXTERNAL");
        },

        onPrintItemPress: function () {
            var oSelectedItem = this._getSelectedDeliveryItem();
            if (!oSelectedItem) {
                this.showTranslatedMessageToast("message.selectItem");
                return;
            }
            this.getView().getModel("ViewSettings").setProperty("/PalletAmount", oSelectedItem.PalletAmount);
            this.getFragment("CreateLabelDialog", this).open();
        },
        onCreateLabelDialogLabelLocalPrintPress: function(oEvent){
            var oDialog = oEvent.getSource().getParent();
            oDialog.close();
            var oSelectedItem = this._getSelectedDeliveryItem();
            var sDeliveryKey = oSelectedItem.DeliveryKey;
            var sItemKey = oSelectedItem.ItemKey;
            var iAmount = oDialog.getContent()[1].getItems()[1].getValue();
            //var iActualQuantity = oSelectedItem.ActualQuantity;
            var iPalletAmount = oSelectedItem.PalletAmount;
            
            this.printLabelLocal(sDeliveryKey, sItemKey, iAmount, iPalletAmount)
                .then(function (oData) {
                    this._openProtocol(oData.PrintLabel);
                    this.showTranslatedMessageToast("message.itemPrinted", [sItemKey]);
                }.bind(this));
        },

        onCreateLabelDialogSavePress: function (oEvent) {
            var oDialog = oEvent.getSource().getParent();
            oDialog.close();
            var iAmount = oDialog.getContent()[1].getItems()[1].getValue();
            var oSelectedItem = this._getSelectedDeliveryItem();
            var sDeliveryKey = oSelectedItem.DeliveryKey;
            var sItemKey = oSelectedItem.ItemKey;
            this.printItem(sDeliveryKey, sItemKey, iAmount)
                .then(function () {
                    this.showTranslatedMessageToast("message.itemPrinted", [sItemKey]);
                }.bind(this));
        },

        onCreateLabelDialogCancelPress: function (oEvent) {
            oEvent.getSource().getParent().close();
        },

        /* =========================================================== */
        /* private methods                                             */
        /* =========================================================== */

        _confirmLoading: function () {
            var oModel = this.getView().getModel();
            this._getItems().forEach(function (oItem, iIndex) {
                oModel.callFunction("/ConfirmLoading", {
                    urlParameters: {
                        DeliveryKey: oItem.DeliveryKey,
                        ItemKey: oItem.ItemKey
                    },
                    batchGroupId: BATCH_GROUP_CONFIRM_LOADING,
                    changeSetId: iIndex
                });
            });
            oModel.setDeferredGroups([BATCH_GROUP_CONFIRM_LOADING]);
            return new Promise(function (resolve, reject) {
                sap.ui.core.BusyIndicator.show(0);
                oModel.submitChanges({
                    batchGroupId: BATCH_GROUP_CONFIRM_LOADING,
                    success: resolve,
                    error: reject
                });
            });
        },

        _confirmUnloading: function () {
            var oModel = this.getView().getModel();
            this._getItems().forEach(function (oItem, iIndex) {
                oModel.callFunction("/ConfirmUnloading", {
                    urlParameters: {
                        DeliveryKey: oItem.DeliveryKey,
                        ItemKey: oItem.ItemKey
                    },
                    batchGroupId: BATCH_GROUP_CONFIRM_UNLOADING,
                    changeSetId: iIndex
                });
            });
            oModel.setDeferredGroups([BATCH_GROUP_CONFIRM_UNLOADING]);
            return new Promise(function (resolve, reject) {
                sap.ui.core.BusyIndicator.show(0);
                oModel.submitChanges({
                    batchGroupId: BATCH_GROUP_CONFIRM_UNLOADING,
                    success: resolve,
                    error: reject
                });
            });
        },

        _handleConfirmLoadingSuccess: function () {
            this.setDeliveryProperty("InspectionStatus", zvgt.hppm.NSPECTION_STATUS.LOADED);
            var oModel = this.getView().getModel();
            oModel.submitChanges({
                success: function () {
                    oModel.refresh(true);
                }
            });
            this.showTranslatedMessageToast("message.deliveryLoaded");
        },

        _handleConfirmUnloadingSuccess: function () {
            this.setDeliveryProperty("InspectionStatus", zvgt.hppm.INSPECTION_STATUS.UNLOADED);
            var oModel = this.getView().getModel();
            oModel.submitChanges({
                success: function () {
                    oModel.refresh(true);
                }
            });
            this.showTranslatedMessageToast("message.deliveryUnloaded");
        },

        _getItems: function () {
            var oList = this.getView().byId("ItemList");
            var aItems = oList.getItems();
            return aItems.map(function (oItem) {
                return {
                    DeliveryKey: oItem.getBindingContext().getModel().getProperty(oItem.getBindingContext().getPath() + "/DeliveryKey"),
                    ItemKey: oItem.getBindingContext().getModel().getProperty(oItem.getBindingContext().getPath() + "/ItemKey")
                };
            });
        },

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
                MaxReturn: oData.MaxReturn,
                SinglePost: false,
                LastItem: oData.LastItem,
                PostingDate: oData.PostingDate,
                SoldToParty: this._getPostItemsSoldToParty()
            }).then(this._showItemsPosted.bind(this));
        },

        _preSelectMaxReturn: function (sDeliveryKey) {
            var oModel = this.getOwnerComponent().getModel();
            var sKey = oModel.createKey("/DeliveryHeadSet", {
                DeliveryKey: sDeliveryKey
            });
            oModel.read(sKey, {
                success: function (oData) {
                    this.getMaxReturnDelivery(oData.SoldToParty)
                        .then(this._setMaxReturnDelivery.bind(this));
                }.bind(this)
            });
        },

        _setMaxReturnDelivery: function (iValue) {
            this._iMaxReturn = iValue;
        },

        _deleteSelectedItem: function () {
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
            this._checkIfPalletNotLoaded(sScan)
                .then(function () {
                    this._handlePalletLoadScan(sScan);
                }.bind(this))
                .catch(function () {
                    this._checkIfPalletLoaded(sScan).then(function () {
                        this._handlePalletUnloadScan(sScan);
                    }.bind(this))
                        .catch(this._showPalletScanErrorMessage.bind(this));
                }.bind(this));
        },

        _handlePalletUnloadScan: function (sCaseNumber) {
            this._getPalletForUnloading(sCaseNumber)
                .then(this._checkIfItemIsNotUnloaded.bind(this))
                .then(this._unloadPallet.bind(this))
                .then(this._submitUnload.bind(this));
        },

        _handlePalletLoadScan: function (sCaseNumber) {
            this._getPalletForLoading(sCaseNumber)
                .then(this._checkIfItemIsNotLoaded.bind(this))
                .then(this._createLoadedPallet.bind(this))
                .then(this._submitLoad.bind(this));
        },

        _checkIfItemIsNotLoaded: function (oPallet) {
            return new Promise(function (resolve, reject) {
                this._getDeliveryItemStatus(oPallet.DeliveryKey, oPallet.ItemKey)
                    .then(function (sStatus) {
                        if (sStatus === zvgt.hppm.INSPECTION_STATUS.LOADED) {
                            reject(oPallet);
                            this.showTranslatedErrorMessage("message.deliveryItemAlreadyLoaded", [oPallet.ItemKey]);
                        } else {
                            resolve(oPallet);
                        }
                    }.bind(this));
            }.bind(this));
        },

        _checkIfItemIsNotUnloaded: function (oPallet) {
            return new Promise(function (resolve, reject) {
                this._getDeliveryItemStatus(oPallet.DeliveryKey, oPallet.ItemKey)
                    .then(function (sStatus) {
                        if (sStatus === zvgt.hppm.INSPECTION_STATUS.UNLOADED) {
                            reject(oPallet);
                            this.showTranslatedErrorMessage("message.deliveryItemAlreadyUnloaded", [oPallet.ItemKey]);
                        } else {
                            resolve(oPallet);
                        }
                    }.bind(this));
            }.bind(this));
        },

        _getItem: function (sDeliveryKey, sItemKey) {
            return this.getItems().find(function (oItem) {
                return oItem.DeliveryKey === sDeliveryKey && oItem.ItemKey === sItemKey;
            });
        },

        _getPalletForLoading: function (sCaseNumber) {
            sap.ui.core.BusyIndicator.show(0);
            return new Promise(function (resolve, reject) {
                this.getView().getModel().read("/PalletSet", {
                    filters: [
                        new sap.ui.model.Filter("CaseNumber", "EQ", sCaseNumber),
                        new sap.ui.model.Filter("Status", "EQ", "NEW")
                    ],
                    success: function (oData) {
                        if (oData.results.length === 1) {
                            resolve(oData.results[0]);
                        } else {
                            reject(sCaseNumber);
                        }
                    },
                    error: reject
                });
            }.bind(this));
        },

        _getPalletForUnloading: function (sCaseNumber) {
            sap.ui.core.BusyIndicator.show(0);
            return new Promise(function (resolve, reject) {
                this.getView().getModel().read("/PalletSet", {
                    filters: [
                        new sap.ui.model.Filter("CaseNumber", "EQ", sCaseNumber),
                        new sap.ui.model.Filter("Status", "EQ", "LOADED")
                    ],
                    success: function (oData) {
                        if (oData.results.length === 1) {
                            resolve(oData.results[0]);
                        } else {
                            reject(sCaseNumber);
                        }
                    },
                    error: reject
                });
            }.bind(this));
        },

        _createLoadedPallet: function (oPallet) {
            var oModel = this.getView().getModel();
            return new Promise(function (resolve, reject) {
                oPallet.Status = zvgt.hppm.PALLET_STATUS.LOADED;
                oPallet.DeliveryKey = oPallet.DeliveryKey;
                oPallet.ItemKey = oPallet.ItemKey;
                oPallet.PalletNumber = "";
                oPallet.Original = false;
                oModel.createEntry("/PalletSet", {
                    properties: oPallet
                });
                resolve(oPallet);
            });
        },

        _unloadPallet: function (oPallet) {
            var oModel = this.getView().getModel();
            var sKey = oModel.createKey("/PalletSet", {
                DeliveryKey: oPallet.DeliveryKey,
                ItemKey: oPallet.ItemKey,
                PalletNumber: oPallet.PalletNumber
            });
            sap.ui.core.BusyIndicator.show(0);
            return new Promise(function (resolve, reject) {
                var bResult = oModel.setProperty(sKey + "/Status", zvgt.hppm.PALLET_STATUS.UNLOADED);
                if (bResult) {
                    var oData = oModel.getProperty(sKey);
                    resolve(oData);
                } else {
                    reject();
                }
            });
        },

        _checkIfPalletNotLoaded: function (sCaseNumber) {
            return new Promise(function (resolve, reject) {
                this.getView().getModel().read("/PalletSet", {
                    filters: [
                        new sap.ui.model.Filter("CaseNumber", "EQ", sCaseNumber),
                        new sap.ui.model.Filter("Status", "EQ", "LOADED"),
                        new sap.ui.model.Filter("Status", "EQ", "UNLOADED"),
                        new sap.ui.model.Filter("Status", "EQ", "USED")
                    ],
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            reject();
                        } else {
                            resolve();
                        }
                    },
                    error: resolve
                });
            }.bind(this));
        },

        _checkIfPalletLoaded: function (sCaseNumber) {
            return new Promise(function (resolve, reject) {
                this.getView().getModel().read("/PalletSet", {
                    filters: [
                        new sap.ui.model.Filter("CaseNumber", "EQ", sCaseNumber),
                        new sap.ui.model.Filter("Status", "EQ", "LOADED")
                    ],
                    success: function (oData) {
                        if (oData.results.length > 0) {
                            resolve();
                        } else {
                            reject();
                        }
                    },
                    error: reject
                });
            }.bind(this));
        },

        _submitLoad: function () {
            var oModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);
            oModel.submitChanges({
                success: this._showPalletLoadedSuccessMessage.bind(this)
            });
        },

        _submitUnload: function () {
            var oModel = this.getView().getModel();
            sap.ui.core.BusyIndicator.show(0);
            oModel.submitChanges({
                success: this._showPalletUnloadedSuccessMessage.bind(this)
            });
        },

        _showPalletLoadedSuccessMessage: function (oData) {
            this.showTranslatedMessageToast("message.palletLoaded");
            this.getView().getModel().refresh(true);
        },

        _showPalletUnloadedSuccessMessage: function (oData) {
            this.showTranslatedMessageToast("message.palletUnloaded");
            this.getView().getModel().refresh(true);
        },

        _showPalletScanErrorMessage: function (oData) {
            this.showTranslatedErrorMessage("message.palletScanError");
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
            if (sStatus === zvgt.hppm.INSPECTION_STATUS.OPEN) {
                this._navToLoadPalletsApp(sDeliveryKey, sItemKey);
            } else if (sStatus === zvgt.hppm.INSPECTION_STATUS.LOADED) {
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

        _mapListItemToGoodsMovementItemData: function (oListItem, iIndex, aItems) {
            return {
                Quantity: oListItem.getCells()[3].getValue().toString(),
                ItemKey: oListItem.getCustomData()[0].getValue(),
                DeliveryKey: this.getDeliveryProperty("DeliveryKey"),
                MaxReturn: oListItem.getCells()[4].getValue().toString(),
                PostingDate: oListItem.getCells()[5].getDateValue() || new Date(),
                LastItem: iIndex === (aItems.length - 1)
            };
        },

        _getPostItemsSoldToParty: function () {
            return this._getPostItemsSoldToPartyControl().getSelectedKey();
        },

        _getPostItemsSoldToPartyControl: function () {
            var oForm = this.getFragment("PostItemsDialog", this).getContent()[0];
            var oContainer = oForm.getFormContainers()[0];
            var oElement = oContainer.getFormElements()[3];
            return oElement.getFields()[0];
        },

        _filterPostItemsSoldToPartyWithDelivery: function() {
            var oBinding = this._getPostItemsSoldToPartyControl().getBinding("items");
            oBinding.filter([new sap.ui.model.Filter("DeliveryNumber", "EQ", this.getDeliveryProperty("DeliveryKey"))], "Applikcation");
        },

        _bindPostItemsDialog: function () {
            this._filterPostItemsSoldToPartyWithDelivery();
            var oList = this._getPostItemsList();
            var sDeliveryKey = this.getDeliveryProperty("DeliveryKey");
            oList.bindAggregation("items", {
                path: "/DeliveryItemSet",
                template: this._createPostItemsDialogTemplate(),
                filters: [
                    new Filter("DeliveryKey", FilterOperator.EQ, sDeliveryKey),
                    new Filter("InspectionStatus", FilterOperator.NE, zvgt.hppm.INSPECTION_STATUS.POSTED)
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
                    new sap.m.Text({
                        text: "{= ${SpecialStock} === 'O' ? ${i18n>postItemDialog.soldStock} : ${i18n>postItemDialog.rentStock} }"
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
                    }),
                    new sap.m.DatePicker({
                        visible: "{= ${SpecialStock} !== 'O' }"
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
            this.bindUploadCollection(sDeliveryKey);
            this._checkAllItemsHavePallets(sDeliveryKey)
                .then(this._setSapPostingEnabled.bind(this));
            this._preSelectMaxReturn(sDeliveryKey);
            this._bindHeaderData(sDeliveryKey);
        },

        _bindHeaderData: function (sDeliveryKey) {
            var oModel = this.getOwnerComponent().getModel();
            var sPath = oModel.createKey("/DeliveryHeadSet", {
                DeliveryKey: sDeliveryKey
            });
            this.getView().getModel().read(sPath, {
                success: function (oData) {
                    this.getView().getModel("Header").setProperty("/", oData);
                }.bind(this)
            });
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
                                    new sap.m.Text({
                                        text: "{i18n>details.currentlyLoaded}: {LoadedAmount} {i18n>general.pieces} ({LoadedPallets})",
                                        visible: "{= ${Header>/DeliveryType} !== 'ZRET' }"
                                    }),
                                    new sap.m.Text({
                                        text: "{i18n>details.currentlyUnloaded}: {UnloadedAmount} {i18n>general.pieces} ({UnloadedPallets})",
                                        visible: "{= ${Header>/DeliveryType} !== 'ZRET' }"
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
                                        visible: "{= ${InspectionStatus} === 'QUANTITY' || ${InspectionStatus} === 'QUALITY' || ${InspectionStatus} === 'POSTED' || ${InspectionStatus} === 'COMPLETED' || ${InspectionStatus} === 'LOADED' || ${InspectionStatus} === 'UNLOADED' }"
                                    }),
                                    new sap.m.ObjectStatus({
                                        text: "{i18n>details.qualityResult}",
                                        icon: "{= ${QualityResult} === true ? 'sap-icon://sys-enter-2' : 'sap-icon://message-error' }",
                                        state: "{= ${QualityResult} === true ? 'Success' : 'Error' }",
                                        visible: "{= ${InspectionStatus} === 'QUALITY' || ${InspectionStatus} === 'POSTED' || ${InspectionStatus} === 'COMPLETED' || ${InspectionStatus} === 'LOADED' || ${InspectionStatus} === 'UNLOADED' }"
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
        },

        _openClaim: function (sClaimType) {
            // TODO: implement actual claim opening logic (e.g. call backend action, navigate to claim app, etc.)
            var sDeliveryKey = this._getCurrentDeliveryKey();
            sap.m.MessageToast.show(sClaimType === "INTERNAL" ?
                this.getResourceBundle().getText("details.openInternalClaim") + " - " + sDeliveryKey :
                this.getResourceBundle().getText("details.openExternalClaim") + " - " + sDeliveryKey);
        },

        _closeClaim: function (sClaimType) {
            // TODO: implement actual claim closing logic (e.g. call backend action, navigate to claim app, etc.)
            var sDeliveryKey = this._getCurrentDeliveryKey();
            sap.m.MessageToast.show(sClaimType === "INTERNAL" ?
                this.getResourceBundle().getText("details.closeInternalClaim") + " - " + sDeliveryKey :
                this.getResourceBundle().getText("details.closeExternalClaim") + " - " + sDeliveryKey);
        }

    });

});
