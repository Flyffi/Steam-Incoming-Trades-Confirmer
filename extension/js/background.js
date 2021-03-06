﻿var audio_notification = new Audio();
audio_notification.preload = 'auto';
audio_notification.src = 'js/sounds/Isnt-it.mp3';

var audioNotif = new Audio();
audioNotif.preload = 'auto';
audioNotif.src = 'js/sounds/notif.mp3';

var active = false;
var removedTab;
var randomTime;
var mainFunctionId;
var allFunctionsId = '';
var acceptingNow = false;
var logined = true;

//=====================outgoing_offers_memory=====================//

var outgoingOffersMemory =
{
	data : {},
	add : function(id)
	{
		outgoingOffersMemory.data[id] = true;
		setTimeout(outgoingOffersMemory.remove, 5*60*1000);
	},
	remove : function(id)
	{
		delete outgoingOffersMemory.data[id];
	}
}

//_____________________outgoing_offers_memory_____________________//

chrome.browserAction.setBadgeText({text: ""});

chrome.notifications.onClicked.addListener(function (notificationId)
{
	if(notificationId == 'login')
	{
		chrome.tabs.create({url: 'https://steamcommunity.com/login/home/'});
	}
	chrome.notifications.clear( notificationId, function () { });
});

chrome.runtime.onMessage.addListener( function(response, sender, senDresponse)
{
	if(typeof response == 'string')
	{
		if(/^audioMsg\:/g.test(response))
		{
			var options = {
			type: "basic",
			title: "Steam Incoming Trades Confirmer",
			message: response.replace(/^audioMsg\:/, ''),
			iconUrl: 'images/icon128.png'
			};
			audioNotif.play();
			chrome.notifications.clear( "audioMsg", function () { });
			chrome.notifications.create( "audioMsg", options, function (id) { });
		}
		if(/^msg\:/g.test(response))
		{
			var options = {
			type: "basic",
			title: "Steam Incoming Trades Confirmer",
			message: response.replace(/^msg\:/, ''),
			iconUrl: 'images/icon128.png'
			};
			chrome.notifications.clear( "msg", function () { });
			chrome.notifications.create( "msg", options, function (id) { });
		}
		else if(response == 'getActive')
		{
			chrome.runtime.sendMessage('active:'+active.toString());
		}
		else if(response == 'login')
		{
			var options = {
			type: "basic",
			title: "Steam Incoming Trades Confirmer",
			message: 'Error:\nClick to login in STEAM!',
			iconUrl: 'images/icon128.png'
			};
			audioNotif.play();
			chrome.notifications.clear( "login", function () { });
			chrome.notifications.create( "login", options, function (id) { });
		}
		else if(/activate\:(.*)/g.test(response))
		{
			var activate = response.replace(/activate\:/g, '');
			if(activate == 'true')
			{
				active = true;
				if(acceptingNow != true)
				{
					mainFunctionId = createUnicalRandomId();
					allFunctionsId = allFunctionsId + mainFunctionId + ';';
					checkingViaAPI(mainFunctionId);
				}
				else
				{
					chrome.runtime.sendMessage('msg:Wait!\nProcessing offers.');
					alert();
				}
			}
			else
			{
				active = false;
				chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
				chrome.browserAction.setBadgeText({ text: "Off"});
				chrome.runtime.sendMessage('active:false');
			}
		}
	}
});

chrome.tabs.onRemoved.addListener( function(tabId, removeInfo)
{
	if (tabId == removedTab)
	{
		setTimeout(Checking, randomTime);
	}
});

function checkingViaAPI(functionId)
{
	if(functionId == mainFunctionId)
	{
		if(logined == true)
		{
			randomTime = parseInt(localStorage.getItem('rate'));
			if(active == true)
			{
				if(localStorage.getItem('apiKey') != undefined && localStorage.getItem('apiKey') != '')
				{
					chrome.browserAction.setBadgeBackgroundColor({ color: '#B9FF00'});
					chrome.browserAction.setBadgeText({ text: "On"});
					var xhr = new XMLHttpRequest();
					xhr.open('GET', 'https://api.steampowered.com/IEconService/GetTradeOffers/v1/?get_received_offers=1&active_only=1&time_historical_cutoff=' + Math.round(Date.now() / 1000) + '&key=' + localStorage.getItem('apiKey'), true);
					xhr.timeout = 30000;
					xhr.send(null);
					var xhrDone = false;
					xhr.ontimeout = function()
					{
						if(!xhrDone)
						{
							xhrDone = true;
							setTimeout(checkingViaAPI, randomTime, functionId);
						}
					}
					xhr.onerror = function()
					{
						if(!xhrDone)
						{
							xhrDone = true;
							setTimeout(checkingViaAPI, randomTime, functionId);
						}
					}
					xhr.onreadystatechange = function()
					{
						if(xhr.readyState == 4 && !xhrDone)
						{
							xhrDone = true;
							if(xhr.status == 200)
							{
								if(xhr.responseText)
								{
									try
									{
										var data = JSON.parse(xhr.responseText);
										if(data.response != undefined)
										{
											if(data.response['trade_offers_received'] != undefined)
											{
												var allTradeOffers = data.response['trade_offers_received'];
												var tradeOffersToConfirm = [];
												var sessionId;
												chrome.cookies.get(
												{
													url : 'https://steamcommunity.com/',
													name : 'sessionid'
												}, function (cookie)
												{
													sessionId = cookie.value;
													if(sessionId != undefined)
													{
														var steamIdList;
														try
														{
															steamIdList = JSON.parse(localStorage.getItem('steamIdList'));
														}
														catch(err) { }
														var i;
														for(i = 0; i < allTradeOffers.length; i++)
														{
															if(allTradeOffers[i]['items_to_give'] == undefined && allTradeOffers[i]['items_to_receive'] != undefined)
															{
																tradeOffersToConfirm.push(allTradeOffers[i]);
															}
															else if(allTradeOffers[i]['items_to_give'] != undefined && steamIdList != undefined && steamIdList['7656119' + (parseInt(allTradeOffers[i]['accountid_other']) + 7960265728)] && !outgoingOffersMemory.data[allTradeOffers[i]['tradeofferid']])
															{
																allTradeOffers[i].outgoing = true;
																tradeOffersToConfirm.push(allTradeOffers[i]);
															}
														}
														if(tradeOffersToConfirm.length > 0)
														{
															function confirmCircle(tradeOffers, sessionId, i, functionId)
															{
																acceptingNow = true;
																var accountIdOther;
																var body;
																var arrayOfReqs = [];
																accountIdOther = parseInt(tradeOffers[i]['accountid_other']);
																accountIdOther = '7656119' + (accountIdOther + 7960265728);
																body = 'sessionid=' + sessionId + '&serverid=1&tradeofferid=' + tradeOffers[i]['tradeofferid'] + '&partner=' + accountIdOther + '&captcha=';
																acceptReq = new XMLHttpRequest();
																acceptReq.open('POST', 'https://steamcommunity.com/tradeoffer/' + tradeOffers[i]['tradeofferid'] + '/accept', true);
																acceptReq.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
																acceptReq.timeout = 10000;
																changeHeadersForTheNextRequest(
																{
																	forUrl : 'https://steamcommunity.com/tradeoffer/' + tradeOffers[i]['tradeofferid'] + '/accept',
																	Referer : 'https://steamcommunity.com/tradeoffer/' + tradeOffers[i]['tradeofferid'] + '/',
																	Origin : 'https://steamcommunity.com'
																});
																acceptReq.send(body);
																var acceptReqDone = false;
																acceptReq.ontimeout = function()
																{
																	if(!acceptReqDone)
																	{
																		acceptReqDone = true;
																		if(i < tradeOffers.length)
																			confirmCircle(tradeOffers, sessionId, i, functionId);
																		else
																		{
																			acceptingNow = false;
																			setTimeout(checkingViaAPI, randomTime, functionId);
																		}
																	}
																}
																acceptReq.onerror = function()
																{
																	acceptReqDone = true;
																		if(i < tradeOffers.length)
																			confirmCircle(tradeOffers, sessionId, i, functionId);
																		else
																		{
																			acceptingNow = false;
																			setTimeout(checkingViaAPI, randomTime, functionId);
																		}
																}
																acceptReq.onreadystatechange = function()
																{
																	if(acceptReq.readyState == 4 && !acceptReqDone)
																	{
																		acceptReqDone = true;
																		i++;
																		if(acceptReq.status == 200)
																		{
																			if(tradeOffers[i - 1].outgoing)
																				outgoingOffersMemory.add(tradeOffers[i - 1]['tradeofferid']);
																			if(i < tradeOffers.length)
																				confirmCircle(tradeOffers, sessionId, i, functionId);
																			else
																			{
																				acceptingNow = false;
																				setTimeout(checkingViaAPI, randomTime, functionId);
																			}
																		}
																		else if(acceptReq.status == 403)
																		{
																			//logined = false;
																			acceptingNow = false;
																			setTimeout(checkingViaAPI, randomTime, functionId);
																		}
																		else
																		{
																			if(i < tradeOffers.length)
																				confirmCircle(tradeOffers, sessionId, i, functionId);
																			else
																			{
																				acceptingNow = false;
																				setTimeout(checkingViaAPI, randomTime, functionId);
																			}
																		}
																	}
																}
															}
															confirmCircle(tradeOffersToConfirm, sessionId, 0, functionId);
														}
														else
														{
															setTimeout(checkingViaAPI, randomTime, functionId);
														}
													}
													else
													{
														/*chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
														chrome.browserAction.setBadgeText({ text: "Off"});
														active = false;
														chrome.runtime.sendMessage('active:false');
														allFunctionsId = allFunctionsId.replace(functionId+';', '');
														chrome.runtime.sendMessage('login');*/
														setTimeout(checkingViaAPI, randomTime, functionId);
													}
												});
											}
											else
											{
												setTimeout(checkingViaAPI, randomTime, functionId);
											}
										}
										else
										{
											chrome.runtime.sendMessage('audioMsg:No response!');
											setTimeout(checkingViaAPI, randomTime, functionId);
										}
									}
									catch(err)
									{
										chrome.runtime.sendMessage('audioMsg:Unexpected error!');
										setTimeout(checkingViaAPI, randomTime, functionId);
									}
								}
								else
								{
									setTimeout(checkingViaAPI, randomTime, functionId);
								}
							}
							else if(xhr.status == 403)
							{
								/*chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
								chrome.browserAction.setBadgeText({ text: "Off"});
								active = false;
								chrome.runtime.sendMessage('active:false');*/
								allFunctionsId = allFunctionsId.replace(functionId+';', '');
								chrome.runtime.sendMessage('audioMsg:Invalid API Key!');
							}
							else
							{
								chrome.runtime.sendMessage('audioMsg:Unexpected request status!');
								setTimeout(checkingViaAPI, randomTime, functionId);
							}
						}
					}
				}
				else
				{
					chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
					chrome.browserAction.setBadgeText({ text: "Off"});
					active = false;
					chrome.runtime.sendMessage('active:false');
					allFunctionsId = allFunctionsId.replace(functionId+';', '');
					chrome.runtime.sendMessage('audioMsg:Set API Key!');
				}
			}
			else
			{
				chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
				chrome.browserAction.setBadgeText({ text: "Off"});
				active = false;
				chrome.runtime.sendMessage('active:false');
				allFunctionsId = allFunctionsId.replace(functionId+';', '');
			}
		}
		else
		{
			logined = true;
			chrome.browserAction.setBadgeBackgroundColor({ color: '#FF0000'});
			chrome.browserAction.setBadgeText({ text: "Off"});
			active = false;
			chrome.runtime.sendMessage('active:false');
			allFunctionsId = allFunctionsId.replace(functionId+';', '');
			chrome.runtime.sendMessage('login');
		}
	}
	else
	{
		allFunctionsId = allFunctionsId.replace(functionId+';', '');
	}
}

function createUnicalRandomId()
{
	var newId;
	do
	{
		newId = createRandomId();
	}
	while(allFunctionsId.indexOf(newId + ';') > -1)
	return newId;
}

function createRandomId()
{
	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	for( var i=0; i < 25; i++ )
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	return text;
}