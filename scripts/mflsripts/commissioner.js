var customizeSettings = [],
  allSettings = [],
  swapArrow = '&#8646;',
  uploadKey = '',
  magicKey = '',
  commishSkin = ''
if (void 0 === disableUserFranchiseName) var disableUserFranchiseName = []
if (void 0 === disableUserOwnerName) var disableUserOwnerName = []
if (void 0 === disableUserEmailAddress) var disableUserEmailAddress = []
if (void 0 === disableUserLoadedIcon) var disableUserLoadedIcon = []
if (void 0 === disableUserLoadedLogo) var disableUserLoadedLogo = []
if (void 0 === disableUserSoundClip) var disableUserSoundClip = []
if (void 0 === disableUserPlayAudioClip) var disableUserPlayAudioClip = []
if (void 0 === disableUserLeagueReminders) var disableUserLeagueReminders = []
if (void 0 === disableUserAbbrev) var disableUserAbbrev = []
if (void 0 === disableUserFullWidth) var disableUserFullWidth = []
if (void 0 === disableUserDesktopView) var disableUserDesktopView = []
if (void 0 === disableUserAdvancedEditor) var disableUserAdvancedEditor = []
if (void 0 === disableUserNote) var disableUserNote = []
if (void 0 === disableUserEmailType) var disableUserEmailType = []
if (void 0 === disableUserEmailVisible) var disableUserEmailVisible = []
if (void 0 === disableUserEmailOptions) var disableUserEmailOptions = []
if (void 0 === disableUserHomePageSetupLink)
  var disableUserHomePageSetupLink = []
if (void 0 === disableUserSkinLink) var disableUserSkinLink = []
if (void 0 === disableUserUnlinkFranchiseLink)
  var disableUserUnlinkFranchiseLink = []
function clearTempForms () {
  $('#tempForm').remove(), setTimeout('$("#ajax_loading").fadeOut(1000)', 1e3)
}
function selectAll (e, t) {
  for (
    var i = e.checked, a = e.name.substr(0, e.name.length - 4), s = 0;
    s < $("input[type='checkbox']").length;
    s++
  ) {
    var n = $("input[type='checkbox']")[s].name.substr(
        $("input[type='checkbox']")[s].name.length - 4,
        4
      ),
      d = $("input[type='checkbox']")[s].name.substr(
        0,
        $("input[type='checkbox']")[s].name.length - 4
      )
    ;('0000' !== a && d !== a && n !== a) ||
      ($("input[type='checkbox']")[s].checked = i)
  }
  switch (t) {
    case 0:
      break
    case 1:
      doDisableHPM()
      break
    case 2:
    case 3:
      updateAbilities(e)
  }
}
function resetCommishView (e) {
  if (($('#ajax_loading').fadeIn(50), '0000' === e))
    for (var t in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(t) &&
        parseInt(franchiseDatabase[t].id) > 0 &&
        ($('body').append(
          '<iframe id="resetIframe_' +
            franchiseDatabase[t].id +
            '" name="resetIframe_' +
            franchiseDatabase[t].id +
            '" style="display:none" src="' +
            baseURLDynamic +
            '/' +
            year +
            '/home_page_setup?L=' +
            league_id +
            '&FRANCHISE_ID=' +
            franchiseDatabase[t].id +
            '&DELETE=1"></iframe>'
        ),
        setTimeout(
          '$("#resetIframe_' + franchiseDatabase[t].id + '").remove()',
          600
        ))
  else
    $('body').append(
      '<iframe id="resetIframe_' +
        e +
        '" name="resetIframe_' +
        e +
        '" style="display:none" src="' +
        baseURLDynamic +
        '/' +
        year +
        '/home_page_setup?L=' +
        league_id +
        '&FRANCHISE_ID=' +
        e +
        '&DELETE=1"></iframe>'
    ),
      setTimeout('$("#resetIframe_' + e + '").remove()', 600)
  $('#ajax_loading').fadeOut(1e3)
}
function resetCommishSkin (e) {
  if (($('#ajax_loading').fadeIn(50), '0000' === e))
    for (var t in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(t) &&
        parseInt(franchiseDatabase[t].id) > 0 &&
        ($('body').append(
          '<iframe id="resetIframe_' +
            franchiseDatabase[t].id +
            '" name="resetIframe_' +
            franchiseDatabase[t].id +
            '" style="display:none" src="' +
            baseURLDynamic +
            '/' +
            year +
            '/appearance?LEAGUE_ID=' +
            league_id +
            '&FRANCHISE_ID=' +
            franchiseDatabase[t].id +
            '&USE_SKIN=' +
            commishSkin +
            '"></iframe>'
        ),
        setTimeout(
          '$("#resetIframe_' + franchiseDatabase[t].id + '").remove()',
          600
        ))
  else
    $('body').append(
      '<iframe id="resetIframe_' +
        e +
        '" name="resetIframe_' +
        e +
        '" style="display:none" src="' +
        baseURLDynamic +
        '/' +
        year +
        '/home_page_setup?L=' +
        league_id +
        '&FRANCHISE_ID=' +
        e +
        '&USE_SKIN=' +
        commishSkin +
        '"></iframe>'
    ),
      setTimeout('$("#resetIframe_' + e + '").remove()', 600)
  $('#ajax_loading').fadeOut(1e3)
}
function updateAbilities (e) {
  $('#ajax_loading').fadeIn(50),
    $('body').append(
      "<iframe id='abilitiesIframe' name='abilitiesIframe' style='position:absolute; top:0; height:0; width:0; visibility:hidden' src='" +
        baseURLDynamic +
        '/' +
        year +
        '/options?L=' +
        league_id +
        "&O=93&PRINTER=1'></iframe>"
    )
  var t = e.name.substr(0, e.name.length - 4),
    i = e.name.substr(e.name.length - 4, 4),
    a = e.checked
  $("input[name^='" + t + "']").attr('disabled', 'disabled'),
    $("input[name^='" + t + "']").addClass('disabled_checkbox'),
    setTimeout("updateAbilities2('" + t + "','" + i + "'," + a + ')', 1e3)
}
function updateAbilities2 (e, t, i) {
  switch (e) {
    case 'userSetupInfo':
      var a = 'SETUP'
      break
    case 'userHomePageLayout':
      a = 'HOME_LAYOUT'
      break
    default:
      a = ''
  }
  if ('0000' === t)
    for (var s in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(s) &&
        parseInt(franchiseDatabase[s].id) > 0 &&
        (i
          ? $('#abilitiesIframe')
              .contents()
              .find('input[name="' + a + franchiseDatabase[s].id + '"]')
              .attr('checked', 'checked')
          : $('#abilitiesIframe')
              .contents()
              .find('input[name="' + a + franchiseDatabase[s].id + '"]')
              .removeAttr('checked', 'checked'))
  else
    i
      ? $('#abilitiesIframe')
          .contents()
          .find('input[name="' + a + t + '"]')
          .attr('checked', 'checked')
      : $('#abilitiesIframe')
          .contents()
          .find('input[name="' + a + t + '"]')
          .removeAttr('checked', 'checked')
  setTimeout("updateAbilities3('" + e + "')", 2e3)
}
function updateAbilities3 (e) {
  $('#abilitiesIframe')
    .contents()
    .find('input[value="Save Abilities"]')
    .trigger('click'),
    $('#ajax_loading').fadeOut(1e3),
    $("input[name^='" + e + "']").removeAttr('disabled'),
    $("input[name^='" + e + "']").removeClass('disabled_checkbox'),
    setTimeout('$("#abilitiesIframe").remove()', 500)
}
function updateForm195 (e, t, i) {
  $('#ajax_loading').fadeIn(50),
    $('body').append(
      "<iframe id='contactIframe' name='contactIframe' style='position:absolute; top:0; height:0; width:0; visibility:hidden' src='" +
        baseURLDynamic +
        '/' +
        year +
        '/csetup?L=' +
        league_id +
        "&FRANCHISES=&C=FCONTACT&PRINTER=1'></iframe>"
    ),
    setTimeout("updateForm195_2('" + e + "','" + t + "','" + i + "')", 1e3)
}
function updateForm195_2 (e, t, i) {
  switch (e) {
    case 'phone':
      var a = 'FRANCHISE_PHONE'
      break
    case 'mailVisible':
      a = 'FRANCHISE_EMAIL_VISIBLE'
      break
    case 'mailType':
      a = 'FRANCHISE_MAIL_TYPE'
      break
    case 'Draft':
      a = 'DRAFT'
      break
    case 'OnTheClock':
      a = 'ONTHECLOCK'
      break
    case 'Auction':
      a = 'AUCTION'
      break
    case 'OpponentLineup':
      a = 'LINEUP'
      break
    case 'LineupReminder':
      a = 'LREMINDER'
      break
    case 'Trade':
      a = 'TRADE'
      break
    case 'TradeBait':
      a = 'TBAIT'
      break
    case 'Waiver':
      a = 'WAIVER'
      break
    case 'IR':
      a = 'IR'
      break
    case 'Taxi':
      a = 'TAXI'
      break
    case 'WeeklyResult':
      a = 'RESULT'
      break
    case 'Injury':
      a = 'INJURY'
      break
    case 'Poll':
      a = 'POLL'
      break
    case 'MessageBoard':
      a = 'MSG_BOARD'
      break
    case 'Article':
      a = 'ARTICLE'
      break
    case 'PlayerNews':
      a = 'PLAYER_NEWS'
      break
    case 'SiteNews':
      a = 'SITE_NEWS'
      break
    case 'MFLNews':
      a = 'MFL_NEWS'
      break
    case 'PromoMessages':
      a = 'PROMO_MESSAGES'
      break
    default:
      a = ''
  }
  if ('0000' === t) {
    for (var s in franchiseDatabase)
      if (
        franchiseDatabase.hasOwnProperty(s) &&
        parseInt(franchiseDatabase[s].id) > 0
      ) {
        if ('checkbox' === i)
          !!$('#mailEvent' + e + '0000').is(':checked')
            ? ($('#contactIframe')
                .contents()
                .find(
                  '#FRANCHISE_MAIL_EVENT' + customizeSettings[s].id + '_' + a
                )
                .attr('checked', 'checked')
                .prop('checked', !0),
              $('#mailEvent' + e + customizeSettings[s].id)
                .attr('checked', 'checked')
                .prop('checked', !0))
            : ($('#contactIframe')
                .contents()
                .find(
                  '#FRANCHISE_MAIL_EVENT' + customizeSettings[s].id + '_' + a
                )
                .removeAttr('checked')
                .prop('checked', !1),
              $('#mailEvent' + e + customizeSettings[s].id)
                .removeAttr('checked')
                .prop('checked', !1))
        if ('radio' === i) {
          switch (e) {
            case 'mailType':
              var n = $('#mailTypeAllHtml').is(':checked') ? 'html' : 'text'
              customizeSettings[s].mailType = n
              break
            case 'mailVisible':
              n = $('#mailVisibleAllYes').is(':checked') ? 'Yes' : 'No'
              customizeSettings[s].mailVisible = n
              break
            default:
              n = ''
          }
          $('#contactIframe')
            .contents()
            .find('#' + a + customizeSettings[s].id + '_' + n)
            .attr('checked', 'checked'),
            $('#' + e + '_' + customizeSettings[s].id + ' span').text(n),
            'html' === n || 'Yes' === n
              ? $('#' + e + '_' + customizeSettings[s].id).removeClass(
                  'warning'
                )
              : $('#' + e + '_' + customizeSettings[s].id).addClass('warning')
        }
      }
  } else {
    if ('checkbox' === i)
      !!$('#mailEvent' + e + t).is(':checked')
        ? $('#contactIframe')
            .contents()
            .find('#FRANCHISE_MAIL_EVENT' + t + '_' + a)
            .attr('checked', 'checked')
        : $('#contactIframe')
            .contents()
            .find('#FRANCHISE_MAIL_EVENT' + t + '_' + a)
            .removeAttr('checked')
    if (
      ('textbox' === i &&
        $('#contactIframe')
          .contents()
          .find("input[name='" + a + t + "']")
          .val($("input[name='" + a + t + "']").val()),
      'radio' === i)
    )
      switch (e) {
        case 'mailType':
          'html' === customizeSettings['fid_' + t].mailType
            ? (customizeSettings['fid_' + t].mailType = 'text')
            : (customizeSettings['fid_' + t].mailType = 'html'),
            $('#contactIframe')
              .contents()
              .find('#' + a + t + '_' + customizeSettings['fid_' + t].mailType)
              .attr('checked', 'checked'),
            $('#' + e + '_' + t + ' span').text(
              customizeSettings['fid_' + t].mailType
            ),
            'html' === customizeSettings['fid_' + t].mailType
              ? $('#' + e + '_' + t).removeClass('warning')
              : $('#' + e + '_' + t).addClass('warning')
          break
        case 'mailVisible':
          'Yes' === customizeSettings['fid_' + t].mailVisible
            ? (customizeSettings['fid_' + t].mailVisible = 'No')
            : (customizeSettings['fid_' + t].mailVisible = 'Yes'),
            $('#contactIframe')
              .contents()
              .find(
                '#' + a + t + '_' + customizeSettings['fid_' + t].mailVisible
              )
              .attr('checked', 'checked'),
            $('#' + e + '_' + t + ' span').text(
              customizeSettings['fid_' + t].mailVisible
            ),
            'Yes' === customizeSettings['fid_' + t].mailVisible
              ? $('#' + e + '_' + t).removeClass('warning')
              : $('#' + e + '_' + t).addClass('warning')
      }
  }
  setTimeout('updateForm195_3()', 2e3)
}
function updateForm195_3 () {
  $('#contactIframe')
    .contents()
    .find('input[value="Save Franchise Info"]')
    .trigger('click'),
    $('#ajax_loading').fadeOut(1e3),
    setTimeout('$("#contactIframe").remove()', 1e3)
}
function updateImage (e, t, i) {
  if (t) {
    var a =
      baseURLDynamic +
      '/' +
      year +
      '/export?TYPE=league&L=' +
      league_id +
      '&JSON=1'
    $.ajax({ type: 'GET', url: a }).done(function (t) {
      for (var a = 0; a < t.league.franchises.franchise.length; a++)
        if (t.league.franchises.franchise[a].id === e) {
          $('#iconThumb' + e).attr(
            'src',
            t.league.franchises.franchise[a].icon +
              '?sid=' +
              Math.floor(1e4 * Math.random()) +
              1
          ),
            $('#iconActual' + e).attr(
              'src',
              t.league.franchises.franchise[a].icon +
                '?sid=' +
                Math.floor(1e4 * Math.random()) +
                1
            ),
            i && $('#iconURL' + e).val(t.league.franchises.franchise[a].icon),
            $('#chooseIcon' + e).attr('style', 'display:inline'),
            $('#uploadIcon' + e).attr('style', 'display:none'),
            (document.getElementById('chosenIcon' + e).value = '')
          break
        }
      setTimeout('$("#ajax_loading").fadeOut(1000)', 1e3)
    })
  } else {
    a =
      baseURLDynamic +
      '/' +
      year +
      '/export?TYPE=league&L=' +
      league_id +
      '&JSON=1'
    $.ajax({ type: 'GET', url: a }).done(function (t) {
      for (var a = 0; a < t.league.franchises.franchise.length; a++)
        if (t.league.franchises.franchise[a].id === e) {
          $('#logoThumb' + e).attr(
            'src',
            t.league.franchises.franchise[a].logo +
              '?sid=' +
              Math.floor(1e4 * Math.random()) +
              1
          ),
            $('#logoActual' + e).attr(
              'src',
              t.league.franchises.franchise[a].logo +
                '?sid=' +
                Math.floor(1e4 * Math.random()) +
                1
            ),
            i && $('#logoURL' + e).val(t.league.franchises.franchise[a].logo),
            $('#chooseLogo' + e).attr('style', 'display:inline'),
            $('#uploadLogo' + e).attr('style', 'display:none'),
            (document.getElementById('chosenLogo' + e).value = '')
          break
        }
      setTimeout('$("#ajax_loading").fadeOut(1000)', 1e3)
    })
  }
}
function uploadImage (e, t) {
  $('#ajax_loading').fadeIn(50),
    t
      ? $('#franchiseSetupFormIcon_' + e).submit()
      : $('#franchiseSetupFormLogo_' + e).submit(),
    setTimeout("updateImage('" + e + "'," + t + ',true)', 100)
}
function updateText (e, t, i, a, s, n, d) {
  var l = ''
  ;(l +=
    '<form id="franchiseSetupForm" action="' +
    baseURLDynamic +
    '/' +
    year +
    '/csetup" method="get" name="franchise" target="tempIframe">\n'),
    (l += '<input type="hidden" name="form_name" value="' + n + '" />\n'),
    (l +=
      '<input type="hidden" name="UPLOAD_KEY" value="' + uploadKey + '" />\n'),
    (l +=
      '<input type="hidden" name="LEAGUE_ID" value="' + league_id + '" />\n'),
    (l += '<input type="hidden" name="MAGIC" value="' + magicKey + '" />\n'),
    (l += '<input type="hidden" name="FRANCHISES" value="' + t + '" />\n'),
    (l += '<input type="hidden" name="C" value="' + d + '" />\n'),
    'franchise' === n || 50 === s
      ? ((l +=
          '<input type="hidden" name="FRANCHISE_NAME' +
          t +
          '" value="' +
          $('#franchiseName_' + t + ' input:eq(0)').val() +
          '" />\n'),
        (l +=
          '<input type="hidden" name="FRANCHISE_OWNER_NAME' +
          t +
          '" value="' +
          $('#ownerName_' + t + ' input:eq(0)').val() +
          '" />\n'),
        (l +=
          '<input type="hidden" name="FRANCHISE_EMAIL' +
          t +
          '" value="' +
          $('#emailAddress_' + t + ' input:eq(0)').val() +
          '" />\n'))
      : (l +=
          '<input type="hidden" name="' + e + t + '" value="' + i + '" />\n'),
    (l += '</form>\n'),
    $('body').append("<div id='tempForm' style='display:none'></div>"),
    $('#tempForm').html(l),
    $('#ajax_loading').fadeIn(50),
    setTimeout('$("#franchiseSetupForm").submit()', 50),
    setTimeout('clearTempForms()', 100),
    'FRANCHISE_ICON' === e &&
      setTimeout("updateImage('" + t + "',true,false)", 100),
    'FRANCHISE_LOGO' === e &&
      setTimeout("updateImage('" + t + "',false,false)", 100)
}
function updateRadio (e, t, i, a) {
  var s = ''
  if (
    ((s +=
      '<form id="franchiseSetupForm" action="' +
      baseURLDynamic +
      '/' +
      year +
      '/csetup" method="get" name="customize" target="tempIframe">\n'),
    (s += '<input type="hidden" name="form_name" value="customize" />\n'),
    (s +=
      '<input type="hidden" name="UPLOAD_KEY" value="' + uploadKey + '" />\n'),
    (s +=
      '<input type="hidden" name="LEAGUE_ID" value="' + league_id + '" />\n'),
    (s += '<input type="hidden" name="C" value="FCUSTOM" />\n'),
    (s +=
      '<input type="hidden" name="input_expires" value="' +
      (currentServerTime + 3600) +
      '" />\n'),
    (s += '<input type="hidden" name="MAGIC" value="' + magicKey + '" />\n'),
    'ALL' === t.toUpperCase())
  ) {
    s += '<input type="hidden" name="FRANCHISES" value="0000" />\n'
    var n = 'Yes' === a ? 'Yes' : 'No'
    for (var d in customizeSettings)
      customizeSettings.hasOwnProperty(d) &&
        ((s +=
          '<input type="hidden" name="' +
          e +
          customizeSettings[d].id +
          '" value="' +
          n +
          '" />\n'),
        $('#' + i + '_' + customizeSettings[d].id + ' span').text(n),
        'Yes' === n
          ? $('#' + i + '_' + customizeSettings[d].id).removeClass('warning')
          : $('#' + i + '_' + customizeSettings[d].id).addClass('warning'))
  } else {
    ;(s += '<input type="hidden" name="FRANCHISES" value="' + t + '" />\n'),
      (s +=
        '<input type="hidden" name="' +
        e +
        t +
        '" value="' +
        (n = 'Yes' === $('#' + i + '_' + t + ' span').text() ? 'No' : 'Yes') +
        '" />\n'),
      $('#' + i + '_' + t + ' span').text(n),
      'Yes' === n
        ? $('#' + i + '_' + t).removeClass('warning')
        : $('#' + i + '_' + t).addClass('warning')
  }
  ;(s += '</form>\n'),
    $('body').append("<div id='tempForm' style='display:none'></div>"),
    $('#tempForm').html(s),
    $('#ajax_loading').fadeIn(50),
    setTimeout('$("#franchiseSetupForm").submit()', 50),
    setTimeout('clearTempForms()', 100)
}
function doCustomizeDisplay (e) {
  0 === e
    ? ($('.display_1').removeClass('not_displayed'),
      $('.display_2').removeClass('not_displayed'),
      $('.display_3').removeClass('not_displayed'),
      $('.display_4').removeClass('not_displayed'),
      $('.display_5').removeClass('not_displayed'),
      $('.menu_display_0')
        .removeClass('menu_not_displayed')
        .addClass('menu_displayed'),
      $('.menu_display_1')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_2')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_3')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_4')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_5')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'))
    : ($('.display_1').addClass('not_displayed'),
      $('.display_2').addClass('not_displayed'),
      $('.display_3').addClass('not_displayed'),
      $('.display_4').addClass('not_displayed'),
      $('.display_5').addClass('not_displayed'),
      $('.display_' + e).removeClass('not_displayed'),
      $('.menu_display_0')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_1')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_2')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_3')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_4')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_5')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display_' + e)
        .removeClass('menu_not_displayed')
        .addClass('menu_displayed'))
}
function doSummaryHTML (e) {
  var t = '',
    i = '',
    a = ''
  ;(t +=
    '<div style="text-align:center">DISPLAY: <a class="menu_display_1" onclick="doCustomizeDisplay(1)">APPEARANCE</a> | <a class="menu_display_3" onclick="doCustomizeDisplay(3)">IMAGES</a> | <a class="menu_display_4" onclick="doCustomizeDisplay(4)">EMAIL</a> | <a class="menu_display_5" onclick="doCustomizeDisplay(5)">TEXTBOX</a> | <a class="menu_display_2" onclick="doCustomizeDisplay(2)">OTHER</a></div>'),
    (t += '<div style="position:relative">'),
    (t +=
      '<table class="report commish_summary" id="franchise_summary"><caption><span>View/Edit Franchise Settings</span></caption><tbody>'),
    (i += '<table class="settings_table_fixed"><tbody>'),
    (a += '<table class="settings_table"><tbody>'),
    (i += '<tr>'),
    (a += '<tr>'),
    (i += '<th colspan="2" class="shift_left_double">Franchise Info</th>'),
    (a +=
      '<th class="display_2 display_3 display_4 display_5" title="Change Franchise Setup Info">Change Franchise Setup Info</th>'),
    (a +=
      '<th class="display_1" title="Customize Home Page">Customize Home Page</th>'),
    (a += '<th class="display_5">Franchise</th>'),
    (a += '<th class="display_5">Owner</th>'),
    (a += '<th class="display_2">Play Audio</th>'),
    (a += '<th class="display_2">Reminders</th>'),
    (a += '<th class="display_1">Full Width</th>'),
    (a += '<th class="display_1">Responsive Site</th>'),
    (a += '<th class="display_2">Adv. Editor</th>'),
    (a += '<th class="display_5" rowspan="2">Abbrev</th>'),
    (a += '<th class="display_3">Franchise</th>'),
    (a += '<th class="display_3">Franchise</th>'),
    (a += '<th class="display_4">E-Mail</th>'),
    (a += '<th class="display_4">E-Mail Visible</th>'),
    (a += '<th class="display_5" rowspan="2">Phone</th>'),
    (a += '<th class="display_4">On The Clock</th>'),
    (a += '<th class="display_4">Trade Proposals/Results</th>'),
    (a += '<th class="display_4">New Poll</th>'),
    (a += '<th class="display_4">New Message Board Topic</th>'),
    (i += '</tr>'),
    (a += '</tr>'),
    (i += '<tr>'),
    (a += '<tr>'),
    (i += '<th class="shift_left_one" style="text-align:left">Name</th>'),
    (i += '<th class="shift_left_two">FID</th>'),
    (a +=
      '<th class="display_2 display_3 display_4 display_5"><input type="checkbox" id="userSetupInfo0000" name="userSetupInfo0000" onclick="selectAll(this,2)" /> Enable All</th>'),
    (a +=
      '<th class="display_1"><input type="checkbox" id="userHomePageLayout0000" name="userHomePageLayout0000" onclick="selectAll(this,3)" /> Enable All</th>'),
    (a += '<th class="display_5">Name</th>'),
    (a += '<th class="display_5">Name(s)</th>'),
    (a +=
      '<th class="display_2"><input type="radio" id="playAudioAllYes"       onclick="$(\'#playAudioAllButton\').removeAttr(\'disabled\');      $(\'#playAudioAllButton\').removeClass(\'buttonDisabled\');"       name="playAudioAll"       value="Yes">Yes <input type="radio" id="playAudioAllNo"       onclick="$(\'#playAudioAllButton\').removeAttr(\'disabled\');      $(\'#playAudioAllButton\').removeClass(\'buttonDisabled\');"       name="playAudioAll"       value="No">No <input id="playAudioAllButton"       class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateRadio( \'PLAY_AUDIO\'                  , \'All\' , \'playAudio\'       , $(\'input[name=playAudioAll]:checked\').val()       )"></th>'),
    (a +=
      '<th class="display_2"><input type="radio" id="leagueRemindersAllYes" onclick="$(\'#leagueRemindersAllButton\').removeAttr(\'disabled\');$(\'#leagueRemindersAllButton\').removeClass(\'buttonDisabled\');" name="leagueRemindersAll" value="Yes">Yes <input type="radio" id="leagueRemindersAllNo" onclick="$(\'#leagueRemindersAllButton\').removeAttr(\'disabled\');$(\'#leagueRemindersAllButton\').removeClass(\'buttonDisabled\');" name="leagueRemindersAll" value="No">No <input id="leagueRemindersAllButton" class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateRadio( \'DISPLAY_FRANCHISE_REMINDERS\' , \'All\' , \'leagueReminders\' , $(\'input[name=leagueRemindersAll]:checked\').val() )"></th>'),
    (a +=
      '<th class="display_1"><input type="radio" id="fullWidthAllYes"       onclick="$(\'#fullWidthAllButton\').removeAttr(\'disabled\');      $(\'#fullWidthAllButton\').removeClass(\'buttonDisabled\');"       name="fullWidthAll"       value="Yes">Yes <input type="radio" id="fullWidthAllNo"       onclick="$(\'#fullWidthAllButton\').removeAttr(\'disabled\');      $(\'#fullWidthAllButton\').removeClass(\'buttonDisabled\');"       name="fullWidthAll"       value="No">No <input id="fullWidthAllButton"       class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateRadio( \'USE_FULL_WIDTH\'              , \'All\' , \'fullWidth\'       , $(\'input[name=fullWidthAll]:checked\').val()       )"></th>'),
    (a +=
      '<th class="display_1"><input type="radio" id="desktopViewAllYes"     onclick="$(\'#desktopViewAllButton\').removeAttr(\'disabled\');    $(\'#desktopViewAllButton\').removeClass(\'buttonDisabled\');"     name="desktopViewAll"     value="Yes">Yes <input type="radio" id="desktopViewAllNo"     onclick="$(\'#desktopViewAllButton\').removeAttr(\'disabled\');    $(\'#desktopViewAllButton\').removeClass(\'buttonDisabled\');"     name="desktopViewAll"     value="No">No <input id="desktopViewAllButton"     class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateRadio( \'USE_RESPONSIVE_SITE\'         , \'All\' , \'desktopView\'     , $(\'input[name=desktopViewAll]:checked\').val()     )"></th>'),
    (a +=
      '<th class="display_2"><input type="radio" id="advancedEditorAllYes"  onclick="$(\'#advancedEditorAllButton\').removeAttr(\'disabled\'); $(\'#advancedEditorAllButton\').removeClass(\'buttonDisabled\');"  name="advancedEditorAll"  value="Yes">Yes <input type="radio" id="advancedEditorAllNo"  onclick="$(\'#advancedEditorAllButton\').removeAttr(\'disabled\'); $(\'#advancedEditorAllButton\').removeClass(\'buttonDisabled\');"  name="advancedEditorAll"  value="No">No <input id="advancedEditorAllButton"  class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateRadio( \'USE_ADVANCED_EDITOR\'         , \'All\' , \'advancedEditor\'  , $(\'input[name=advancedEditorAll]:checked\').val()  )"></th>'),
    (a += '<th class="display_3">Icon</th>'),
    (a += '<th class="display_3">Logo</th>'),
    (a += '<th class="display_4">Address(es)</th>'),
    (a +=
      '<th class="display_4"><input type="radio" id="mailVisibleAllYes" onclick="$(\'#mailVisibleAllButton\').removeAttr(\'disabled\'); $(\'#mailVisibleAllButton\').removeClass(\'buttonDisabled\')" name="mailVisibleAll" value="Yes">Yes <input type="radio" id="mailVisibleAllNo" onclick="$(\'#mailVisibleAllButton\').removeAttr(\'disabled\'); $(\'#mailVisibleAllButton\').removeClass(\'buttonDisabled\')" name="mailVisibleAll" value="No">No <input id="mailVisibleAllButton" class="buttonDisabled" disabled="disabled" type="button" value=" All " onclick="updateForm195( \'mailVisible\' , \'0000\' , \'radio\' )"></th>'),
    (a +=
      '<th class="display_4"><input type="checkbox" id="mailEventOnTheClock0000" name="mailEventOnTheClock0000" onclick="updateForm195( \'OnTheClock\' , \'0000\' , \'checkbox\' )" /> Enable All</th>'),
    (a +=
      '<th class="display_4"><input type="checkbox" id="mailEventTrade0000" name="mailEventTrade0000" onclick="updateForm195( \'Trade\' , \'0000\' , \'checkbox\' )" /> Enable All</th>'),
    (a +=
      '<th class="display_4"><input type="checkbox" id="mailEventPoll0000" name="mailEventPoll0000" onclick="updateForm195( \'Poll\' , \'0000\' , \'checkbox\' )" /> Enable All</th>'),
    (a +=
      '<th class="display_4"><input type="checkbox" id="mailEventMessageBoard0000" name="mailEventMessageBoard0000" onclick="updateForm195( \'MessageBoard\' , \'0000\' , \'checkbox\' )" /> Enable All</th>'),
    (i += '</tr>'),
    (a += '</tr>')
  var s = 0
  for (var n in customizeSettings)
    if (customizeSettings.hasOwnProperty(n)) {
      if (s % 2) var d = 'eventablerow'
      else d = 'oddtablerow'
      if (
        ((i += '<tr class="' + d + '">'),
        (a += '<tr class="' + d + '">'),
        (i +=
          '<td class="shift_left_one ' +
          d +
          '">' +
          franchiseDatabase[n].name +
          '</td>'),
        (i +=
          '<td class="shift_left_two ' +
          d +
          '">' +
          customizeSettings[n].id +
          '</td>'),
        'On' === customizeSettings[n].setupAbility)
      )
        var l = ' checked="checked"'
      else l = ''
      if (
        ((a +=
          '<td class="display_2 display_3 display_4 display_5"><input type="checkbox" id="userSetupInfo' +
          customizeSettings[n].id +
          '" name="userSetupInfo' +
          customizeSettings[n].id +
          '"' +
          l +
          ' onclick="updateAbilities(this)" /></td>'),
        'On' === customizeSettings[n].customizeAbility)
      )
        l = ' checked="checked"'
      else l = ''
      if (
        ((a +=
          '<td class="display_1"><input type="checkbox" id="userHomePageLayout' +
          customizeSettings[n].id +
          '" name="userHomePageLayout' +
          customizeSettings[n].id +
          '"' +
          l +
          ' onclick="updateAbilities(this)" /></td>'),
        (a +=
          '<td class="display_5" id="franchiseName_' +
          customizeSettings[n].id +
          '"><input type="text" name="FRANCHISE_NAME' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].franchiseName +
          '" size="15" style="width:11.25rem"><input type="button" value="GO" onclick="updateText( \'FRANCHISE_NAME\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_NAME" +
          customizeSettings[n].id +
          "]').val() , 'franchiseName_' , 50 , 'franchise' , 'FRANCHISE')\"></td>"),
        (a +=
          '<td class="display_5" id="ownerName_' +
          customizeSettings[n].id +
          '"><input type="text" name="FRANCHISE_OWNER_NAME' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].ownerName +
          '" size="15" style="width:6.25rem"><input type="button" value="GO" onclick="updateText( \'FRANCHISE_OWNER_NAME\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_OWNER_NAME" +
          customizeSettings[n].id +
          "]').val() , 'ownerName_' , 50 , 'franchise' , 'FRANCHISE')\"></td>"),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].playAudio ? '' : 'warning ') +
          'display_2" id="playAudio_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].playAudio +
          '</span><a class="swap" title="change and update" onclick="updateRadio( \'PLAY_AUDIO\'                  , \'' +
          customizeSettings[n].id +
          "' , 'playAudio'       )\">" +
          swapArrow +
          '</a></td>'),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].leagueReminders ? '' : 'warning ') +
          'display_2" id="leagueReminders_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].leagueReminders +
          '</span><a class="swap" title="change and update" onclick="updateRadio( \'DISPLAY_FRANCHISE_REMINDERS\' , \'' +
          customizeSettings[n].id +
          "' , 'leagueReminders' )\">" +
          swapArrow +
          '</a></td>'),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].fullWidth ? '' : 'warning ') +
          'display_1" id="fullWidth_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].fullWidth +
          '</span><a class="swap" title="change and update" onclick="updateRadio( \'USE_FULL_WIDTH\'              , \'' +
          customizeSettings[n].id +
          "' , 'fullWidth'       )\">" +
          swapArrow +
          '</a></td>'),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].desktopView ? '' : 'warning ') +
          'display_1" id="desktopView_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].desktopView +
          '</span><a class="swap" title="change and update" onclick="updateRadio( \'USE_RESPONSIVE_SITE\'         , \'' +
          customizeSettings[n].id +
          "' , 'desktopView'     )\">" +
          swapArrow +
          '</a></td>'),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].advancedEditor ? '' : 'warning ') +
          'display_2" id="advancedEditor_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].advancedEditor +
          '</span><a class="swap" title="change and update" onclick="updateRadio( \'USE_ADVANCED_EDITOR\'         , \'' +
          customizeSettings[n].id +
          "' , 'advancedEditor'  )\">" +
          swapArrow +
          '</a></td>'),
        (a +=
          '<td class="display_5" id="abbrev_' +
          customizeSettings[n].id +
          '"><input type="text" name="FRANCHISE_ABBREV' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].abbrev +
          '" size="4" maxlength="4" style="width:3.5rem"><input type="button" value="GO" onclick="updateText( \'FRANCHISE_ABBREV\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_ABBREV" +
          customizeSettings[n].id +
          "]').val() , 'abbrev_' , 197 ,  'customize' , 'FCUSTOM')\"></td>"),
        (a +=
          '<td class="display_3" id="icon_' + customizeSettings[n].id + '">'),
        '' === franchiseDatabase[n].icon)
      )
        var o = ''
      else o = '?sid=' + currentServerTime
      if (
        ((a +=
          '<div class="tooltip"><img src="' +
          franchiseDatabase[n].icon +
          o +
          '" class="iconThumb" id="iconThumb' +
          customizeSettings[n].id +
          '" style="vertical-align:middle" /><span class="tooltipimg"><img src="' +
          franchiseDatabase[n].icon +
          o +
          '" id="iconActual' +
          customizeSettings[n].id +
          '" /></span></div>'),
        (a +=
          '<input id="iconURL' +
          customizeSettings[n].id +
          '" style="width:12.5rem;vertical-align:middle" type="text" name="FRANCHISE_ICON' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].icon +
          '" size="15"><input type="button" value="Apply" onclick="updateText( \'FRANCHISE_ICON\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_ICON" +
          customizeSettings[n].id +
          "]').val() , 'icon_' , 197 ,  'customize' , 'FCUSTOM')\">"),
        (a +=
          '<form style="display:inline-block" id="franchiseSetupFormIcon_' +
          customizeSettings[n].id +
          '" action="' +
          baseURLDynamic +
          '/' +
          year +
          '/csetup" method="post" name="customize" enctype="multipart/form-data" target="tempIframe">'),
        (a += '<input type="hidden" name="form_name" value="customize" />'),
        (a +=
          '<input type="hidden" name="UPLOAD_KEY" value="' +
          uploadKey +
          '" />'),
        (a +=
          '<input type="hidden" name="LEAGUE_ID" value="' + league_id + '" />'),
        (a += '<input type="hidden" name="C" value="FCUSTOM" />'),
        (a += '<input type="hidden" name="MAGIC" value="' + magicKey + '" />'),
        (a +=
          '<input type="hidden" name="FRANCHISES" value="' +
          customizeSettings[n].id +
          '" />'),
        (a +=
          '<span id="chooseIcon' +
          customizeSettings[n].id +
          '"><label class="custom-file-upload"><input id="chosenIcon' +
          customizeSettings[n].id +
          '" style="display:none" type="file" accept=".png,.gif,.jpg,.jpeg" name="FRANCHISE_ICON_FILE' +
          customizeSettings[n].id +
          '" value size="40" onchange="$(\'#chooseIcon' +
          customizeSettings[n].id +
          "').attr('style','display:none');$('#uploadIcon" +
          customizeSettings[n].id +
          "').attr('style','display:inline;');\" onabort=\"$('#chooseIcon" +
          customizeSettings[n].id +
          "').attr('style','display:inline');$('#uploadIcon" +
          customizeSettings[n].id +
          "').attr('style','display:none;');\" />Choose Icon</label></span>"),
        (a +=
          '<span id="uploadIcon' +
          customizeSettings[n].id +
          '" style="display:none"><input style="vertical-align:middle;" type="button" value="Upload" onclick="uploadImage(\'' +
          customizeSettings[n].id +
          '\',true)" /><input style="vertical-align:middle;" type="button" value="Cancel"  onclick="$(\'#chooseIcon' +
          customizeSettings[n].id +
          "').attr('style','display:inline');$('#uploadIcon" +
          customizeSettings[n].id +
          "').attr('style','display:none;');document.getElementById('chosenIcon" +
          customizeSettings[n].id +
          "').value='';\"  /></span>"),
        (a += '</form>'),
        (a += '</td>'),
        (a +=
          '<td class="display_3" id="logo_' + customizeSettings[n].id + '">'),
        '' === franchiseDatabase[n].logo)
      )
        o = ''
      else o = '?sid=' + currentServerTime
      ;(a +=
        '<div class="tooltip"><img src="' +
        franchiseDatabase[n].logo +
        o +
        '" class="logoThumb" id="logoThumb' +
        customizeSettings[n].id +
        '" style="vertical-align:middle" /><span class="tooltipimg"><img src="' +
        franchiseDatabase[n].logo +
        o +
        '" id="logoActual' +
        customizeSettings[n].id +
        '" /></span></div>'),
        (a +=
          '<input id="logoURL' +
          customizeSettings[n].id +
          '" style="width:12.5rem;vertical-align:middle" type="text" name="FRANCHISE_LOGO' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].logo +
          '" size="15"><input type="button" value="Apply" onclick="updateText( \'FRANCHISE_LOGO\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_LOGO" +
          customizeSettings[n].id +
          "]').val() , 'logo_' , 197 ,  'customize' , 'FCUSTOM')\">"),
        (a +=
          '<form style="display:inline-block" id="franchiseSetupFormLogo_' +
          customizeSettings[n].id +
          '" action="' +
          baseURLDynamic +
          '/' +
          year +
          '/csetup" method="post" name="franchise_setup" enctype="multipart/form-data" target="tempIframe">'),
        (a += '<input type="hidden" name="form_name" value="customize" />'),
        (a +=
          '<input type="hidden" name="UPLOAD_KEY" value="' +
          uploadKey +
          '" />'),
        (a +=
          '<input type="hidden" name="LEAGUE_ID" value="' + league_id + '" />'),
        (a += '<input type="hidden" name="C" value="FCUSTOM" />'),
        (a += '<input type="hidden" name="MAGIC" value="' + magicKey + '" />'),
        (a +=
          '<input type="hidden" name="FRANCHISES" value="' +
          customizeSettings[n].id +
          '" />'),
        (a +=
          '<span id="chooseLogo' +
          customizeSettings[n].id +
          '"><label class="custom-file-upload"><input id="chosenLogo' +
          customizeSettings[n].id +
          '" style="display:none" type="file" accept=".png,.gif,.jpg,.jpeg" name="FRANCHISE_LOGO_FILE' +
          customizeSettings[n].id +
          '" value size="40" onchange="$(\'#chooseLogo' +
          customizeSettings[n].id +
          "').attr('style','display:none');$('#uploadLogo" +
          customizeSettings[n].id +
          "').attr('style','display:inline;');\" onabort=\"$('#chooseLogo" +
          customizeSettings[n].id +
          "').attr('style','display:inline');$('#uploadLogo" +
          customizeSettings[n].id +
          "').attr('style','display:none;');\" />Choose Logo</label></span>"),
        (a +=
          '<span id="uploadLogo' +
          customizeSettings[n].id +
          '" style="display:none"><input style="vertical-align:middle;" type="button" value="Upload" onclick="uploadImage(\'' +
          customizeSettings[n].id +
          '\',false)" /><input style="vertical-align:middle;" type="button" value="Cancel"  onclick="$(\'#chooseLogo' +
          customizeSettings[n].id +
          "').attr('style','display:inline');$('#uploadLogo" +
          customizeSettings[n].id +
          "').attr('style','display:none;');document.getElementById('chosenLogo" +
          customizeSettings[n].id +
          "').value='';\"  /></span>"),
        (a += '</form>'),
        (a += '</td>'),
        (a +=
          '<td class="display_4" id="emailAddress_' +
          customizeSettings[n].id +
          '"><input type="text" name="FRANCHISE_EMAIL' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].email +
          '" size="15" style="width:11.25rem"><input type="button" value="GO" onclick="updateText( \'FRANCHISE_EMAIL\' , \'' +
          customizeSettings[n].id +
          "' , $('input[name=FRANCHISE_EMAIL" +
          customizeSettings[n].id +
          "]').val() , 'emailAddress_' , 50 ,  'franchise' , 'FRANCHISE')\"></td>"),
        (a +=
          '<td class="' +
          ('Yes' === customizeSettings[n].mailVisible ? '' : 'warning ') +
          'display_4" id="mailVisible_' +
          customizeSettings[n].id +
          '"><span>' +
          customizeSettings[n].mailVisible +
          '</span><a class="swap" title="change and update" onclick="updateForm195( \'mailVisible\' , \'' +
          customizeSettings[n].id +
          "' , 'radio' )\">" +
          swapArrow +
          '</a></td>')
      customizeSettings[n].mailType
      if (
        ((a +=
          '<td class="display_5" id="phone_' +
          customizeSettings[n].id +
          '"><input type="text" name="FRANCHISE_PHONE' +
          customizeSettings[n].id +
          '" value="' +
          customizeSettings[n].phone +
          '" size="10" style="width:5.625rem"><input type="button" value="GO" onclick="updateForm195( \'phone\' , \'' +
          customizeSettings[n].id +
          "' , 'textbox' )\"></td>"),
        'On' === customizeSettings[n].mailEventOnTheClock)
      )
        l = ' checked="checked"'
      else l = ''
      if (
        ((a +=
          '<td class="display_4"><input type="checkbox" id="mailEventOnTheClock' +
          customizeSettings[n].id +
          '" name="mailEventOnTheClock' +
          customizeSettings[n].id +
          '"' +
          l +
          " onclick=\"updateForm195( 'OnTheClock' , '" +
          customizeSettings[n].id +
          "' , 'checkbox' )\" /></td>"),
        'On' === customizeSettings[n].mailEventTrade)
      )
        l = ' checked="checked"'
      else l = ''
      if (
        ((a +=
          '<td class="display_4"><input type="checkbox" id="mailEventTrade' +
          customizeSettings[n].id +
          '" name="mailEventTrade' +
          customizeSettings[n].id +
          '"' +
          l +
          " onclick=\"updateForm195( 'Trade' , '" +
          customizeSettings[n].id +
          "' , 'checkbox' )\" /></td>"),
        'On' === customizeSettings[n].mailEventPoll)
      )
        l = ' checked="checked"'
      else l = ''
      if (
        ((a +=
          '<td class="display_4"><input type="checkbox" id="mailEventPoll' +
          customizeSettings[n].id +
          '" name="mailEventPoll' +
          customizeSettings[n].id +
          '"' +
          l +
          " onclick=\"updateForm195( 'Poll' , '" +
          customizeSettings[n].id +
          "' , 'checkbox' )\" /></td>"),
        'On' === customizeSettings[n].mailEventMessageBoard)
      )
        l = ' checked="checked"'
      else l = ''
      ;(a +=
        '<td class="display_4"><input type="checkbox" id="mailEventMessageBoard' +
        customizeSettings[n].id +
        '" name="mailEventMessageBoard' +
        customizeSettings[n].id +
        '"' +
        l +
        " onclick=\"updateForm195( 'MessageBoard' , '" +
        customizeSettings[n].id +
        "' , 'checkbox' )\" /></td>"),
        (i += '</tr>'),
        (a += '</tr>'),
        s++
    }
  ;(t +=
    '<tr><td style="width:12.5rem;">' +
    (i += '</tbody></table>') +
    '</td><td><div class="wrap_settings_table">' +
    (a += '</tbody></table></div>') +
    '</div></td></tr>'),
    (t += '</tbody></table></div></td></tr>'),
    (t += '</tbody>'),
    (t += '</table>'),
    (t += '</div>'),
    $('#summaryContainer').html(t),
    e && doCustomizeDisplay(1)
}
function doCustomizeDisplay2 (e) {
  0 === e
    ? ($('.display2_1').removeClass('not_displayed'),
      $('.display2_2').removeClass('not_displayed'),
      $('.display2_3').removeClass('not_displayed'),
      $('.display2_4').removeClass('not_displayed'),
      $('.display2_5').removeClass('not_displayed'),
      $('.display2_6').removeClass('not_displayed'),
      $('.menu_display2_0')
        .removeClass('menu_not_displayed')
        .addClass('menu_displayed'),
      $('.menu_display2_1')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_2')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_3')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_4')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_5')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_6')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'))
    : ($('.display2_1').addClass('not_displayed'),
      $('.display2_2').addClass('not_displayed'),
      $('.display2_3').addClass('not_displayed'),
      $('.display2_4').addClass('not_displayed'),
      $('.display2_5').addClass('not_displayed'),
      $('.display2_6').addClass('not_displayed'),
      $('.display2_' + e).removeClass('not_displayed'),
      $('.menu_display2_0')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_1')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_2')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_3')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_4')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_5')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_6')
        .removeClass('menu_displayed')
        .addClass('menu_not_displayed'),
      $('.menu_display2_' + e)
        .removeClass('menu_not_displayed')
        .addClass('menu_displayed'))
}
function doDisableFeatures (e) {
  if (
    ((html = ''),
    (html_1 = ''),
    (html_2 = ''),
    (html +=
      '<div style="text-align:center">DISPLAY: <a class="menu_display2_1" onclick="doCustomizeDisplay2(1)">APPEARANCE</a> | <a class="menu_display2_2" onclick="doCustomizeDisplay2(2)">IMAGES/SOUND</a> | <a class="menu_display2_3" onclick="doCustomizeDisplay2(3)">EMAIL</a> | <a class="menu_display2_4" onclick="doCustomizeDisplay2(4)">TEXT BOX</a> | <a class="menu_display2_6" onclick="doCustomizeDisplay2(6)">OTHER</a></div>'),
    (html += '<div style="position:relative">'),
    (html +=
      '<table class="report commish_summary" id="disable_summary"><caption><span>Hide Options from Franchise Users</span></caption><tbody>'),
    (html_1 += '<table class="settings_table_fixed"><tbody>'),
    (html_2 += '<table class="settings_table"><tbody>'),
    (html_1 += '<tr>'),
    (html_2 += '<tr>'),
    (html_1 += '<th colspan="2" class="shift_left_double">Franchise Info</th>'),
    (html_2 += '<th class="display2_4">Franchise Name</th>'),
    (html_2 += '<th class="display2_4">Owner Name(s)</th>'),
    (html_2 += '<th class="display2_3">Email Address(es)</th>'),
    (html_2 += '<th class="display2_2">Upload Icon</th>'),
    (html_2 += '<th class="display2_2">Upload Logo</th>'),
    (html_2 += '<th class="display2_2">Upload Sound</th>'),
    (html_2 += '<th class="display2_2">Play Audio Clip</th>'),
    (html_2 += '<th class="display2_6">League Reminders</th>'),
    (html_2 += '<th class="display2_4">Abbrev</th>'),
    (html_2 += '<th class="display2_1">Full Width</th>'),
    (html_2 += '<th class="display2_1">Responsive View</th>'),
    (html_2 += '<th class="display2_6">Advanced Editor</th>'),
    (html_2 += '<th class="display2_6">Note</th>'),
    (html_2 += '<th class="display2_3">Email Type</th>'),
    (html_2 += '<th class="display2_3">Email Visibility</th>'),
    (html_2 += '<th class="display2_3">Email Options</th>'),
    (html_2 += '<th class="display2_1">Unlink Franchise Link</th>'),
    (html_2 += '<th class="display2_1">Home Page Link</th>'),
    (html_2 += '<th class="display2_1">Skin Link</th>'),
    (html_1 += '</tr>'),
    (html_2 += '</tr>'),
    (html_1 += '<tr>'),
    (html_2 += '<tr>'),
    (html_1 += '<th class="shift_left_one" style="text-align:left">Name</th>'),
    (html_1 += '<th class="shift_left_two">FID</th>'),
    disableUserFranchiseName['0000'])
  )
    var t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_4"><input type="checkbox" id="userFranchiseName0000" name="userFranchiseName0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserOwnerName['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_4"><input type="checkbox" id="userOwnerName0000" name="userOwnerName0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserEmailAddress['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_3"><input type="checkbox" id="userEmailAddress0000" name="userEmailAddress0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserLoadedIcon['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_2"><input type="checkbox" id="userLoadedIcon0000" name="userLoadedIcon0000"' +
      t +
      ' onclick="selectAll(this,1)" />Hide All</th>'),
    disableUserLoadedLogo['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_2"><input type="checkbox" id="userLoadedLogo0000" name="userLoadedLogo0000"' +
      t +
      ' onclick="selectAll(this,1)" />Hide All</th>'),
    disableUserSoundClip['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_2"><input type="checkbox" id="userSoundClip0000" name="userSoundClip0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserPlayAudioClip['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_2"><input type="checkbox" id="userPlayAudioClip0000" name="userPlayAudioClip0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserLeagueReminders['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_6"><input type="checkbox" id="userLeagueReminders0000" name="userLeagueReminders0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserAbbrev['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_4"><input type="checkbox" id="userAbbrev0000" name="userAbbrev0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserFullWidth['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_1"><input type="checkbox" id="userFullWidth0000" name="userFullWidth0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserDesktopView['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_1"><input type="checkbox" id="userDesktopView0000" name="userDesktopView0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserAdvancedEditor['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_6"><input type="checkbox" id="userAdvancedEditor0000" name="userAdvancedEditor0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserNote['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_6"><input type="checkbox" id="userNote0000" name="userNote0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserEmailType['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_3"><input type="checkbox" id="userEmailType0000" name="userEmailType0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserEmailVisible['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_3"><input type="checkbox" id="userEmailVisible0000" name="userEmailVisible0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserEmailOptions['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_3"><input type="checkbox" id="userEmailOptions0000" name="userEmailOptions0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserUnlinkFranchiseLink['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_1"><input type="checkbox" id="userUnlinkFranchiseLink0000" name="userUnlinkFranchiseLink0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserHomePageSetupLink['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  if (
    ((html_2 +=
      '<th class="display2_1"><input type="checkbox" id="userHomePageSetupLink0000" name="userHomePageSetupLink0000"' +
      t +
      ' onclick="selectAll(this,1)" /> Hide All</th>'),
    disableUserSkinLink['0000'])
  )
    t = ' checked="checked"'
  else t = ''
  ;(html_2 +=
    '<th class="display2_1"><input type="checkbox" id="userSkinLink0000" name="userSkinLink0000"' +
    t +
    ' onclick="selectAll(this,1)" /> Hide All</th>'),
    (html_1 += '</tr>'),
    (html_2 += '</tr>')
  var i = 0
  for (var a in customizeSettings)
    if (customizeSettings.hasOwnProperty(a)) {
      if (i % 2) var s = 'eventablerow'
      else s = 'oddtablerow'
      if (
        ((html_1 += '<tr class="' + s + '">'),
        (html_2 += '<tr class="' + s + '">'),
        (html_1 +=
          '<td class="shift_left_one ' +
          s +
          '">' +
          franchiseDatabase[a].name +
          '</td>'),
        (html_1 +=
          '<td class="shift_left_two ' +
          s +
          '">' +
          customizeSettings[a].id +
          '</td>'),
        disableUserFranchiseName[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_4"><input type="checkbox" id="userFranchiseName' +
          customizeSettings[a].id +
          '" name="userFranchiseName' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserOwnerName[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_4"><input type="checkbox" id="userOwnerName' +
          customizeSettings[a].id +
          '" name="userOwnerName' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserEmailAddress[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_3"><input type="checkbox" id="userEmailAddress' +
          customizeSettings[a].id +
          '" name="userEmailAddress' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserLoadedIcon[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_2"><input type="checkbox" id="userLoadedIcon' +
          customizeSettings[a].id +
          '" name="userLoadedIcon' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserLoadedLogo[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_2"><input type="checkbox" id="userLoadedLogo' +
          customizeSettings[a].id +
          '" name="userLoadedLogo' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserSoundClip[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_2"><input type="checkbox" id="userSoundClip' +
          customizeSettings[a].id +
          '" name="userSoundClip' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserPlayAudioClip[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_2"><input type="checkbox" id="userPlayAudioClip' +
          customizeSettings[a].id +
          '" name="userPlayAudioClip' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserLeagueReminders[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_6"><input type="checkbox" id="userLeagueReminders' +
          customizeSettings[a].id +
          '" name="userLeagueReminders' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserAbbrev[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_4"><input type="checkbox" id="userAbbrev' +
          customizeSettings[a].id +
          '" name="userAbbrev' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserFullWidth[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_1"><input type="checkbox" id="userFullWidth' +
          customizeSettings[a].id +
          '" name="userFullWidth' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserDesktopView[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_1"><input type="checkbox" id="userDesktopView' +
          customizeSettings[a].id +
          '" name="userDesktopView' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserAdvancedEditor[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_6"><input type="checkbox" id="userAdvancedEditor' +
          customizeSettings[a].id +
          '" name="userAdvancedEditor' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserNote[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_6"><input type="checkbox" id="userNote' +
          customizeSettings[a].id +
          '" name="userNote' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserEmailType[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_3"><input type="checkbox" id="userEmailType' +
          customizeSettings[a].id +
          '" name="userEmailType' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserEmailVisible[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_3"><input type="checkbox" id="userEmailVisible' +
          customizeSettings[a].id +
          '" name="userEmailVisible' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserEmailOptions[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_3"><input type="checkbox" id="userEmailOptions' +
          customizeSettings[a].id +
          '" name="userEmailOptions' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserUnlinkFranchiseLink[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_1"><input type="checkbox" id="userUnlinkFranchiseLink' +
          customizeSettings[a].id +
          '" name="userUnlinkFranchiseLink' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserHomePageSetupLink[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      if (
        ((html_2 +=
          '<td class="display2_1"><input type="checkbox" id="userHomePageSetupLink' +
          customizeSettings[a].id +
          '" name="userHomePageSetupLink' +
          customizeSettings[a].id +
          '"' +
          t +
          ' onclick="doDisableHPM()" /></td>'),
        disableUserSkinLink[customizeSettings[a].id])
      )
        t = ' checked="checked"'
      else t = ''
      ;(html_2 +=
        '<td class="display2_1"><input type="checkbox" id="userSkinLink' +
        customizeSettings[a].id +
        '" name="userSkinLink' +
        customizeSettings[a].id +
        '"' +
        t +
        ' onclick="doDisableHPM()" /></td>'),
        (html_1 += '</tr>'),
        (html_2 += '</tr>'),
        i++
    }
  ;(html_1 += '</tbody></table>'),
    (html_2 += '</tbody></table></div>'),
    (html +=
      '<tr><td style="width:12.5rem;">' +
      html_1 +
      '</td><td><div class="wrap_settings_table">' +
      html_2 +
      '</div></td></tr>'),
    (html += '</tbody></table></div></td></tr>'),
    (html += '</tbody>'),
    (html += '</table>'),
    (html += '</div>'),
    $('#disableContainer').html(html),
    e && doCustomizeDisplay2(1)
}
function doDisableHPM () {
  var e = ''
  ;(e +=
    '\n\n\x3c!-- HPM #50 - GLOBAL VARS FOR HIDING OPTIONS FROM OWNERS - MESSAGE START --\x3e\n\n'),
    (e +=
      '\n\n<style>#body_csetup_fcustom form[action="csetup"],#body_csetup_funlink form[action="csetup"],#body_csetup_fmobile form[action="csetup"],#body_csetup_fcontact form[action="csetup"],#body_csetup_fcustom form[action="csetup"],#body_csetup_franchise form[action="csetup"],#body_csetup_faccess form[action="csetup"],#body_csetup_hmpgmod form[action="csetup"],#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar,#body_csetup_funlink div[id^="csetup_"] .weekly-navbar,#body_csetup_fmobile div[id^="csetup_"] .weekly-navbar,#body_csetup_fcontact div[id^="csetup_"] .weekly-navbar,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar,#body_csetup_franchise div[id^="csetup_"] .weekly-navbar,#body_csetup_faccess div[id^="csetup_"] .weekly-navbar,#body_csetup_hmpgmod div[id^="csetup_"] .weekly-navbar,#body_csetup_skin div[id^="csetup_"] .weekly-navbar,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_funlink div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fmobile div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcontact div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_franchise div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_faccess div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_hmpgmod div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_skin div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcustom div[id^="csetup_"] .reportnavigation,#body_csetup_funlink div[id^="csetup_"] .reportnavigation,#body_csetup_fmobile div[id^="csetup_"] .reportnavigation,#body_csetup_fcontact div[id^="csetup_"] .reportnavigation,#body_csetup_fcustom div[id^="csetup_"] .reportnavigation,#body_csetup_franchise div[id^="csetup_"] .reportnavigation,#body_csetup_faccess div[id^="csetup_"] .reportnavigation,#body_csetup_hmpgmod div[id^="csetup_"] .reportnavigation,#body_csetup_skin div[id^="csetup_"] .reportnavigation{visibility:hidden}</style>\n\n'),
    (e += '<script>\n'),
    (e += 'var disableUserFranchiseName = [];\n'),
    (e += 'var disableUserOwnerName = [];\n'),
    (e += 'var disableUserEmailAddress = [];\n'),
    (e += 'var disableUserLoadedIcon = [];\n'),
    (e += 'var disableUserLoadedLogo = [];\n'),
    (e += 'var disableUserSoundClip = [];\n'),
    (e += 'var disableUserPlayAudioClip = [];\n'),
    (e += 'var disableUserLeagueReminders = [];\n'),
    (e += 'var disableUserAbbrev = [];\n'),
    (e += 'var disableUserFullWidth = [];\n'),
    (e += 'var disableUserDesktopView = [];\n'),
    (e += 'var disableUserAdvancedEditor = [];\n'),
    (e += 'var disableUserNote = [];\n'),
    (e += 'var disableUserEmailType = [];\n'),
    (e += 'var disableUserEmailVisible = [];\n'),
    (e += 'var disableUserEmailOptions = [];\n'),
    (e += 'var disableUserUnlinkFranchiseLink = [];\n'),
    (e += 'var disableUserHomePageSetupLink = [];\n'),
    (e += 'var disableUserSkinLink = [];\n')
  var t = '',
    i = '',
    a = '',
    s = '',
    n = '',
    d = '',
    l = '',
    o = '',
    c = '',
    r = '',
    m = '',
    u = '',
    p = '',
    h = '',
    _ = '',
    b = '',
    y = '',
    f = '',
    g = ''
  for (var v in franchiseDatabase)
    franchiseDatabase.hasOwnProperty(v) &&
      parseInt(franchiseDatabase[v].id) > 0 &&
      ($('#userFranchiseName' + franchiseDatabase[v].id).prop('checked') &&
        (t +=
          "disableUserFranchiseName['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userOwnerName' + franchiseDatabase[v].id).prop('checked') &&
        (i +=
          "disableUserOwnerName['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userEmailAddress' + franchiseDatabase[v].id).prop('checked') &&
        (a +=
          "disableUserEmailAddress['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userLoadedIcon' + franchiseDatabase[v].id).prop('checked') &&
        (s +=
          "disableUserLoadedIcon['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userLoadedLogo' + franchiseDatabase[v].id).prop('checked') &&
        (n +=
          "disableUserLoadedLogo['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userSoundClip' + franchiseDatabase[v].id).prop('checked') &&
        (d +=
          "disableUserSoundClip['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userPlayAudioClip' + franchiseDatabase[v].id).prop('checked') &&
        (l +=
          "disableUserPlayAudioClip['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userLeagueReminders' + franchiseDatabase[v].id).prop('checked') &&
        (c +=
          "disableUserLeagueReminders['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userAbbrev' + franchiseDatabase[v].id).prop('checked') &&
        (o += "disableUserAbbrev['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userFullWidth' + franchiseDatabase[v].id).prop('checked') &&
        (r +=
          "disableUserFullWidth['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userDesktopView' + franchiseDatabase[v].id).prop('checked') &&
        (m +=
          "disableUserDesktopView['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userAdvancedEditor' + franchiseDatabase[v].id).prop('checked') &&
        (u +=
          "disableUserAdvancedEditor['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userNote' + franchiseDatabase[v].id).prop('checked') &&
        (p += "disableUserNote['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userEmailType' + franchiseDatabase[v].id).prop('checked') &&
        (h +=
          "disableUserEmailType['" + franchiseDatabase[v].id + "'] = true;\n"),
      $('#userEmailVisible' + franchiseDatabase[v].id).prop('checked') &&
        (_ +=
          "disableUserEmailVisible['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userEmailOptions' + franchiseDatabase[v].id).prop('checked') &&
        (b +=
          "disableUserEmailOptions['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userUnlinkFranchiseLink' + franchiseDatabase[v].id).prop('checked') &&
        (y +=
          "disableUserUnlinkFranchiseLink['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userHomePageSetupLink' + franchiseDatabase[v].id).prop('checked') &&
        (f +=
          "disableUserHomePageSetupLink['" +
          franchiseDatabase[v].id +
          "'] = true;\n"),
      $('#userSkinLink' + franchiseDatabase[v].id).prop('checked') &&
        (g +=
          "disableUserSkinLink['" + franchiseDatabase[v].id + "'] = true;\n"))
  ;(e +=
    t + i + a + s + n + d + l + c + o + r + m + u + p + h + _ + b + y + f + g),
    (e += '</script>\n'),
    (e += '<script>\n'),
    (e += '$(document).ready(function(){\n'),
    (e +=
      '$("head").append(\'<style>#body_csetup_fcustom .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_funlink .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_fmobile .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_fcontact .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_fcustom .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_franchise .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_faccess .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_hmpgmod .report tr.ability-row + tr[id*="row_hint_"],#body_csetup_skin .report tr.ability-row + tr[id*="row_hint_"]{display:none!important}#body_csetup_fcustom form[action="csetup"],#body_csetup_funlink form[action="csetup"],#body_csetup_fmobile form[action="csetup"],#body_csetup_fcontact form[action="csetup"],#body_csetup_fcustom form[action="csetup"],#body_csetup_franchise form[action="csetup"],#body_csetup_faccess form[action="csetup"],#body_csetup_hmpgmod form[action="csetup"],#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar,#body_csetup_funlink div[id^="csetup_"] .weekly-navbar,#body_csetup_fmobile div[id^="csetup_"] .weekly-navbar,#body_csetup_fcontact div[id^="csetup_"] .weekly-navbar,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar,#body_csetup_franchise div[id^="csetup_"] .weekly-navbar,#body_csetup_faccess div[id^="csetup_"] .weekly-navbar,#body_csetup_hmpgmod div[id^="csetup_"] .weekly-navbar,#body_csetup_skin div[id^="csetup_"] .weekly-navbar,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_funlink div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fmobile div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcontact div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcustom div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_franchise div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_faccess div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_hmpgmod div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_skin div[id^="csetup_"] .weekly-navbar-mobile,#body_csetup_fcustom div[id^="csetup_"] .reportnavigation,#body_csetup_funlink div[id^="csetup_"] .reportnavigation,#body_csetup_fmobile div[id^="csetup_"] .reportnavigation,#body_csetup_fcontact div[id^="csetup_"] .reportnavigation,#body_csetup_fcustom div[id^="csetup_"] .reportnavigation,#body_csetup_franchise div[id^="csetup_"] .reportnavigation,#body_csetup_faccess div[id^="csetup_"] .reportnavigation,#body_csetup_hmpgmod div[id^="csetup_"] .reportnavigation,#body_csetup_skin div[id^="csetup_"] .reportnavigation{visibility:visible!important}</style>\');\n'),
    (e += ' if (typeof franchise_id !== "undefined") {\n'),
    (e += "\t\tif(franchise_id!=='0000') {\n"),
    (e +=
      "\t\t\tif (disableUserUnlinkFranchiseLink['0000']||disableUserUnlinkFranchiseLink[franchise_id]) {\n"),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().find("a").each(function(){ if($(this).text()==="Unlink Franchise") $(this).remove();}); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().html($(".reportnaviationheader").parent().html().replace("|&nbsp;&nbsp;|","|")); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".weekly-navbar-mobile select option").each(function(){ if($(this).text()==="Unlink Franchise") $(this).remove();}); } catch(er) {}\n'),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserHomePageSetupLink['0000']||disableUserHomePageSetupLink[franchise_id]) {\n"),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().find("a").each(function(){ if($(this).text()==="Home Page Modules") $(this).remove();}); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().html($(".reportnaviationheader").parent().html().replace("|&nbsp;&nbsp;|","|")); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".weekly-navbar-mobile select option").each(function(){ if($(this).text()==="Home Page Modules") $(this).remove();}); } catch(er) {}\n'),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserSkinLink['0000']||disableUserSkinLink[franchise_id]) {\n"),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().find("a").each(function(){ if($(this).text()==="Skin") $(this).remove();}); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".reportnavigationheader").parent().html($(".reportnaviationheader").parent().html().replace("|&nbsp;&nbsp;|","|")); } catch(er) {}\n'),
    (e +=
      '\t\t\t\ttry { $(".weekly-navbar-mobile select option").each(function(){ if($(this).text()==="Skin") $(this).remove();}); } catch(er) {}\n'),
    (e += '\t\t\t}\n'),
    (e += '\t\t}\n'),
    (e += '\t}\n'),
    (e += "\tif(document.getElementById('body_csetup_franchise')) {\n"),
    (e += "\t\tif(franchise_id!=='0000') {\n"),
    (e +=
      "\t\t\tif (disableUserFranchiseName['0000']||disableUserFranchiseName[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_NAME0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to change your team name.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_NAME0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserOwnerName['0000']||disableUserOwnerName[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_OWNER_NAME0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to change your personal name.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_OWNER_NAME0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserEmailAddress['0000']||disableUserEmailAddress[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_EMAIL0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to change your email address.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_EMAIL0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e += '\t\t}\n'),
    (e += '\t}\n'),
    (e += "\tif(document.getElementById('body_csetup_fcustom')) {\n"),
    (e += "\t\tif(franchise_id!=='0000') {\n"),
    (e +=
      "\t\t\tif (disableUserLoadedIcon['0000']||disableUserLoadedIcon[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_ICON_FILE0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable changing your team icon.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_ICON0\"]').closest('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_ICON_FILE0\"]').closest('tr').prev('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_ICON_FILE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserLoadedLogo['0000']||disableUserLoadedLogo[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_LOGO_FILE0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable changing your team logo.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_LOGO0\"]').closest('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_LOGO_FILE0\"]').closest('tr').prev('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_LOGO_FILE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserSoundClip['0000']||disableUserSoundClip[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_SOUND_FILE0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable uploading audio files.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_SOUND0\"]').closest('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_SOUND_FILE0\"]').closest('tr').prev('tr').remove();\n"),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_SOUND_FILE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserPlayAudioClip['0000']||disableUserPlayAudioClip[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="PLAY_AUDIO0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable playing audio clips.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"PLAY_AUDIO0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserLeagueReminders['0000']||disableUserLeagueReminders[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="DISPLAY_FRANCHISE_REMINDERS0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable league reminders.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"DISPLAY_FRANCHISE_REMINDERS0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserAbbrev['0000']||disableUserAbbrev[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_ABBREV0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable changing your team abbreviation.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_ABBREV0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserFullWidth['0000']||disableUserFullWidth[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="USE_FULL_WIDTH0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable changing to full width view.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"USE_FULL_WIDTH0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserDesktopView['0000']||disableUserDesktopView[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="USE_FULL_WIDTH0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable changing to responsive view.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"USE_RESPONSIVE_SITE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserAdvancedEditor['0000']||disableUserAdvancedEditor[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="USE_ADVANCED_EDITOR0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable usage of the advanced editor.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"USE_ADVANCED_EDITOR0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserNote['0000']||disableUserNote[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'[id^="NOTES0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to enable usage of custom notes.</span></td></tr>\');\n'),
    (e += "\t\t\t\t$('[id^=\"NOTES0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e += '\t\t}\n'),
    (e += '\t}\n'),
    (e += "\tif(document.getElementById('body_csetup_fcontact')) {\n"),
    (e += "\t\tif(franchise_id!=='0000') {\n"),
    (e +=
      "\t\t\tif (disableUserEmailType['0000']||disableUserEmailType[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_MAIL_TYPE0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Commissioner has set emails in plain text form as HTML is problematic.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_MAIL_TYPE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserEmailVisible['0000']||disableUserEmailVisible[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_EMAIL_VISIBLE0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner to hide your email address from other owners.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_EMAIL_VISIBLE0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e +=
      "\t\t\tif (disableUserEmailOptions['0000']||disableUserEmailOptions[franchise_id]) {\n"),
    (e +=
      '\t\t\t\t$(\'input[name^="FRANCHISE_MAIL_EVENT0"]\').closest(\'tr\').after(\'<tr class="oddtablerow ability-row"><td colspan="1"></td><td colspan="2" class="tdalert tdalert-info-table"><span><b>Attn:</b> Contact your commissioner select email options.</span></td></tr>\');\n'),
    (e +=
      "\t\t\t\t$('input[name^=\"FRANCHISE_MAIL_EVENT0\"]').closest('tr').remove();\n"),
    (e += '\t\t\t}\n'),
    (e += '\t\t}\n'),
    (e += '\t}\n'),
    (e += '});\n'),
    (e += '</script>\n\n'),
    (e +=
      '\x3c!-- HPM #50 - GLOBAL VARS FOR HIDING OPTIONS FROM OWNERS - MESSAGE END --\x3e\n\n'),
    (MSG_Name = '#50 - GLOBAL VARS FOR HIDING OPTIONS FROM OWNERS'),
    $.ajax({
      url:
        baseURLDynamic +
        '/' +
        year +
        '/message?LEAGUE_ID=' +
        league_id +
        '&NAME=message50&IN_FOOTER=Yes',
      xhrFields: { withCredentials: !0 },
      data: { MSG: e, LABEL: MSG_Name },
      cache: !1,
      type: 'POST',
      success: function (e) {},
      error: function (e) {}
    })
}
function checkAllSettings (e) {
  if (
    allSettings[0] &&
    allSettings[1] &&
    allSettings[2] &&
    allSettings[3] &&
    allSettings[4]
  ) {
    switch (e) {
      case 0:
      default:
        doSummaryHTML(!0)
        break
      case 1:
        doDisableFeatures(!0)
    }
    setTimeout('$("#ajax_loading").fadeOut(1000)', 1e3)
  }
}
function getAllSettings (e) {
  ;(allSettings[0] = !1),
    (allSettings[1] = !1),
    (allSettings[2] = !1),
    (allSettings[3] = !1),
    (allSettings[4] = !1)
  var t =
    baseURLDynamic +
    '/' +
    year +
    '/csetup?L=' +
    league_id +
    '&FRANCHISES=&C=FCONTACT&PRINTER=1'
  $.ajax({ type: 'GET', url: t }).done(function (t) {
    for (var i in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(i) &&
        parseInt(franchiseDatabase[i].id) > 0 &&
        (void 0 === customizeSettings[i] &&
          (customizeSettings[i] = { id: franchiseDatabase[i].id }),
        $(t)
          .find(
            '[id="FRANCHISE_EMAIL_VISIBLE' +
              franchiseDatabase[i].id +
              '_Yes"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailVisible =
              'checked' === $(this).attr('checked') ? 'Yes' : 'No'
          }),
        $(t)
          .find(
            '[id="FRANCHISE_MAIL_TYPE' +
              franchiseDatabase[i].id +
              '_html"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailType =
              'checked' === $(this).attr('checked') ? 'html' : 'text'
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_PHONE' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].phone = $(this).attr('value')
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_DRAFT:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventDraft =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_ONTHECLOCK:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventOnTheClock =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_AUCTION:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventAuction =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_LINEUP:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventOppLineup =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_LREMINDER:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventLineupReminder =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_TRADE:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventTrade =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_TBAIT:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventTradeBait =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_WAIVER:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventWaiver =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find('#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_IR:eq(0)')
          .each(function () {
            customizeSettings[i].mailEventIR =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_TAXI:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventTaxi =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_RESULT:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventResult =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_INJURY:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventInjury =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_POLL:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventPoll =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_MSG_BOARD:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventMessageBoard =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' + franchiseDatabase[i].id + '_ARTICLE:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventArticle =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_PLAYER_NEWS:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventPlayerNews =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_SITE_NEWS:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventSiteNews =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_MFL_NEWS:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventMFLNews =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            '#FRANCHISE_MAIL_EVENT' +
              franchiseDatabase[i].id +
              '_PROMO_MESSAGES:eq(0)'
          )
          .each(function () {
            customizeSettings[i].mailEventPromoMessages =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }))
    ;(t = null), (allSettings[4] = !0), checkAllSettings(e)
  })
  t =
    baseURLDynamic +
    '/' +
    year +
    '/csetup?L=' +
    league_id +
    '&FRANCHISES=&C=FRANCHISE&PRINTER=1'
  $.ajax({ type: 'GET', url: t }).done(function (t) {
    for (var i in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(i) &&
        parseInt(franchiseDatabase[i].id) > 0 &&
        (void 0 === customizeSettings[i] &&
          (customizeSettings[i] = { id: franchiseDatabase[i].id }),
        $(t)
          .find(
            'input[name="FRANCHISE_NAME' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].franchiseName = $(this).attr('value')
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_OWNER_NAME' +
              franchiseDatabase[i].id +
              '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].ownerName = $(this).attr('value')
          }),
        $(t)
          .find(
            'input[name="TWITTER_USERNAME' +
              franchiseDatabase[i].id +
              '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].twitterName = $(this).attr('value')
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_EMAIL' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].email = $(this).attr('value')
          }))
    ;(t = null), (allSettings[3] = !0), checkAllSettings(e)
  })
  t =
    baseURLDynamic +
    '/' +
    year +
    '/csetup?L=' +
    league_id +
    '&FRANCHISES=&C=SKIN&PRINTER=1'
  $.ajax({ type: 'GET', url: t }).done(function (t) {
    $(t)
      .find('input[name^="USE_SKIN"]')
      .each(function () {
        'checked' === $(this).attr('checked') &&
          (commishSkin = 'skin id:' + $(this).attr('value'))
      }),
      (t = null),
      (allSettings[2] = !0),
      checkAllSettings(e)
  })
  t =
    baseURLDynamic + '/' + year + '/options?L=' + league_id + '&O=93&PRINTER=1'
  $.ajax({ type: 'GET', url: t }).done(function (t) {
    for (var i in franchiseDatabase)
      franchiseDatabase.hasOwnProperty(i) &&
        parseInt(franchiseDatabase[i].id) > 0 &&
        (void 0 === customizeSettings[i] &&
          (customizeSettings[i] = { id: franchiseDatabase[i].id }),
        $(t)
          .find('input[name="SETUP' + franchiseDatabase[i].id + '"]:eq(0)')
          .each(function () {
            customizeSettings[i].setupAbility =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }),
        $(t)
          .find(
            'input[name="HOME_LAYOUT' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].customizeAbility =
              'checked' === $(this).attr('checked') ? 'On' : ''
          }))
    ;(t = null), (allSettings[1] = !0), checkAllSettings(e)
  })
  t =
    baseURLDynamic +
    '/' +
    year +
    '/csetup?L=' +
    league_id +
    '&FRANCHISES=&C=FCUSTOM&PRINTER=1'
  $.ajax({ type: 'GET', url: t }).done(function (t) {
    for (var i in ($(t)
      .find('[name="MAGIC"]:eq(0)')
      .each(function () {
        magicKey = $(this).attr('value')
      }),
    $(t)
      .find('[name="UPLOAD_KEY"]:eq(0)')
      .each(function () {
        uploadKey = $(this).attr('value')
      }),
    franchiseDatabase))
      franchiseDatabase.hasOwnProperty(i) &&
        parseInt(franchiseDatabase[i].id) > 0 &&
        (void 0 === customizeSettings[i] &&
          (customizeSettings[i] = { id: franchiseDatabase[i].id }),
        $(t)
          .find('[id="PLAY_AUDIO' + franchiseDatabase[i].id + '_Yes"]:eq(0)')
          .each(function () {
            customizeSettings[i].playAudio =
              'checked' === $(this).attr('checked') ? 'Yes' : 'No'
          }),
        $(t)
          .find(
            '[id="DISPLAY_FRANCHISE_REMINDERS' +
              franchiseDatabase[i].id +
              '_Yes"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].leagueReminders =
              'checked' === $(this).attr('checked') ? 'Yes' : 'No'
          }),
        $(t)
          .find(
            '[id="USE_FULL_WIDTH' + franchiseDatabase[i].id + '_Yes"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].fullWidth =
              'checked' === $(this).attr('checked') ? 'Yes' : 'No'
          }),
        $(t)
          .find(
            '[id="USE_RESPONSIVE_SITE' + franchiseDatabase[i].id + '_No"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].desktopView =
              'checked' === $(this).attr('checked') ? 'No' : 'Yes'
          }),
        $(t)
          .find(
            '[id="USE_ADVANCED_EDITOR' +
              franchiseDatabase[i].id +
              '_Yes"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].advancedEditor =
              'checked' === $(this).attr('checked') ? 'Yes' : 'No'
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_ICON' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].icon = $(this).attr('value')
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_LOGO' + franchiseDatabase[i].id + '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].logo = $(this).attr('value')
          }),
        $(t)
          .find(
            'input[name="FRANCHISE_ABBREV' +
              franchiseDatabase[i].id +
              '"]:eq(0)'
          )
          .each(function () {
            customizeSettings[i].abbrev = $(this).attr('value')
          }))
    ;(t = null), (allSettings[0] = !0), checkAllSettings(e)
  })
}
function triggerSummary () {
  '' === uploadKey
    ? ($('#ajax_loading').fadeIn(50), setTimeout('getAllSettings(0)', 1e3))
    : doSummaryHTML(!0)
}
function triggerDisableFeatures () {
  '' === uploadKey
    ? ($('#ajax_loading').fadeIn(50), setTimeout('getAllSettings(1)', 1e3))
    : doDisableFeatures(!0)
}
$('head').append(
  '<style>#commishContainer{width:100%;margin-bottom:1.25rem}#summaryContainer,#disableContainer{margin:0.625rem 0}.commish_summary{margin:0;table-layout:fixed}.commish_summary td{text-align:center}.commish_summary td.warning{color:inherit;background:initial;font-weight:700}.swap{cursor:pointer;padding-left:0.313rem}#ajax_loading{position:fixed;width:100%;height:100%;background:rgba(0,0,0,.7);top:0;left:0;z-index:999999}#ajax_loading .MFLPlayerPopupLoader{position:absolute;top:50%;left:50%;margin-left:-3.75rem;margin-top:-3.75rem}.buttonDisabled:hover{cursor:default!important}.triggerButton{min-width:18.75rem}.commish_summary table{border-spacing:0!important}.commish_summary td{vertical-align:top;padding:0}.commish_summary table td,.commish_summary table th{white-space:nowrap;box-shadow:none;vertical-align:middle;padding:0 0.125rem;height:1.875rem}.commish_summary table th{line-height:1.875rem;border:0}.commish_summary table td{padding:0!important;height:1.875rem}.commish_summary .settings_table td{padding:0 0.313rem!important}.commish_summary .wrap_settings_table{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}.commish_summary .settings_table{overflow:hidden}.commish_summary table input[type="button"]{cursor:pointer!important}.commish_summary table input[type="checkbox"]{cursor:pointer!important}.commish_summary table input.disabled_checkbox[type="checkbox"]{cursor:default!important}.settings_table_fixed td.shift_left_one{max-width:10rem;overflow:hidden;text-align:left!important}.not_displayed{display:none}.menu_displayed{font-weight:700}.menu_not_displayed{cursor:pointer}.iconThumb,.logoThumb{height:auto;width:auto;cursor:progress;max-height:1.625rem}.tooltip{position:relative;display:inline-block}.tooltip .tooltipimg{display:none;text-align:center;padding:0.313rem 0;position:absolute;z-index:1;bottom:-100%}.tooltip:hover .tooltipimg{display:inline}.tooltip img[src=""]{width:1.625rem;height:1.625rem;box-sizing:border-box;padding-left:1.625rem;background:#fff;box-shadow:inset 0 0 0 0.063rem #ddd;text-indent:-9999rem}.tooltipimg img[src=""]{display:none}.commish_summary table input{height:1.625rem;padding:0 0.25rem!important;margin:0 0.25rem!important;vertical-align:middle;-ms-transform:none;-moz-transform:none;-webkit-transform:none;-o-transform:none}.custom-file-upload{margin:0 0.25rem!important;padding:0.188rem 0.25rem!important;cursor:pointer;vertical-align:middle;border-radius:0.188rem;background:#fff;color:#000;border:0.063rem solid #fff;}.settings_table .custom-file-upload:hover{background:#bbb;border-color:#bbb}</style>'
),
  'undefined' == typeof franchise_id
    ? $('#commishContainer').html(
        "<div class='warning'>You do not have authority to view this page.</div>"
      )
    : '0000' === franchise_id
    ? $('#commishContainer').html(
        '<div id="summaryContainer"><input style="display:block;margin:0 auto" type="button" class="triggerButton" value=\'SHOW "FRANCHISE SETTINGS" TABLE\' onclick="triggerSummary()" /></div><div id="disableContainer"><input style="display:block;margin:0 auto" type="button" class="triggerButton" value=\'SHOW "HIDE OPTIONS" TABLE\' onclick="triggerDisableFeatures()" /></div>'
      )
    : $('#commishContainer').html(
        "<div class='warning'>You do not have authority to view this page.</div>"
      ),
  $('body').append(
    '<div id="ajax_loading" style="display:none;"><div class="report" style="border-radius:1.25rem; opacity:0.90;position:absolute;left:50%;top:50%;width:12.5rem;height:12.5rem;margin-left:-6.25rem;margin-top:-6.25rem;"><div class="MFLPlayerPopupLoader"></div></div></div>'
  ),
  $('body').append(
    "<iframe id='tempIframe' name='tempIframe' style='display:none' src=''></iframe>"
  )
