var $contents = $('#contents');
var $sourceContents = $('#source-contents');
var $dataSources = $('#data-sources > tbody');
var $usersContents = $('#users');
var $tableContents;
var $settings = $('form[data-settings]');
var $noResults = $('.no-results-found');

var organizationId = Fliplet.Env.get('organizationId');
var connection;
var currentDataSourceId;
var currentEditor;
var dataSources;

var dataSourceEntriesHasChanged = false;

// Entries
var updateEntriesInterval = 3000;  // Initially set to 3 seconds and dobe it on every get entries without new results
// Queu to hold operations to be sent to server. The key is the row index
var queue = {};                    




// Fetch all data sources
function getDataSources() {
  if (tinymce.editors.length) {
    tinymce.editors[0].remove();
  }

  $contents.removeClass('hidden');
  $sourceContents.addClass('hidden');
  $('[data-save]').addClass('disabled');

  // If we already have data sources no need to go further.
  if (dataSources) {
    return;
  }

  Fliplet.DataSources.get({
      roles: 'publisher,editor',
      type: null
    })
    .then(function onGetDataSources(userDataSources) {
      dataSources = userDataSources;
      $dataSources.empty();
      dataSources.forEach(renderDataSource);
    });
}

function fetchCurrentDataSourceDetails() {
  return Fliplet.DataSources.getById(currentDataSourceId).then(function(dataSource) {
    $settings.find('#id').html(dataSource.id);
    $settings.find('[name="name"]').val(dataSource.name);
    if (!dataSource.bundle) {
      $('#bundle').prop('checked', true);
    }
    if (dataSource.definition) {
      $('#definition').val(JSON.stringify(dataSource.definition, null, 2));
    }
  });
}

function fetchCurrentDataSourceUsers() {
  return Fliplet.DataSources.connect(currentDataSourceId).then(function(source) {
    source.getUsers().then(function(users) {
      var tpl = Fliplet.Widget.Templates['templates.users'];
      var html = tpl({
        users: users
      });
      $usersContents.html(html);
    });
  });
}

function defaultValueRenderer(instance, td, row, col, prop, value, cellProperties) {
  var escaped = Handsontable.helper.stringify(value);
  td.innerHTML = escaped;
  $(td).css({
    'font-weight': 'bold',
    'background-color': '#e4e4e4'
  });
}

/**
 * This will get new entries if the updated at date is newer than what we already have.
 * TODO: Get only new/deleted entries
 */
function getNewEntries() {
  return Fliplet.DataSources.getById(currentDataSourceId).then(function(dataSource) {
    columns = dataSource.columns;
    return source.find({});
  });

}

function dataSourceUpated () {

}

function fetchCurrentDataSourceEntries() {
  var columns;
  var rows = [];

  return Fliplet.DataSources.connect(currentDataSourceId).then(function(source) {
      connection = source;
      return Fliplet.DataSources.getById(currentDataSourceId).then(function(dataSource) {
        columns = dataSource.columns;

        return source.find({});
      });
    }).then(function(rows) {

      if (!rows || !rows.length) {
        $('.sample-data').show();
      }

      rows = rows.map(function (entry) {
        var data = entry.data || {};
        var row = columns.map(function(column) {
          return data.hasOwnProperty(column) ? data[column] : '';
        });
        row.unshift(entry.id);
        return row;
      });

      columns.unshift('_id');
      rows.unshift(columns);

      columns = columns || [];

      $('.table-entries').css('visibility', 'visible');

      // Cloned saved data for other uses
      var cloneData;

      var hot;
      var autosaveNotification;
      var rowIndexToHide = [];
      var cellChanges = [];
      var changedCellColour = '#fff9c6';
      var hotElement = document.querySelector('#hot');
      var searchField = document.getElementById('search_field');
      var savedConsole = $('#saved-data');
      var hotElementContainer = hotElement.parentNode;

      var mode = ''; // TODO: Check what's this

      var hotSettings = {
        data: rows,
        contextMenu: ['row_above', 'row_below', 'col_left', 'col_right', 'remove_row', 'remove_col', 'undo', 'redo'],
        rowHeaders: true,
        colHeaders: true,
        minSpareRows: 0,
        minSpareCols: 0,
        fixedRowsTop: 1,
        autoWrapRow: true,
        stretchH: 'all',
        columnSorting: false,
        manualRowResize: true,
        manualColumnResize: true,
        manualRowMove: false,
        manualColumnMove: false,
        fillHandle: false,
        autoColumnSize: {
          samplingRatio: 23
        },
        hiddenRows: {
          indicators: true
        },
        cells: function(row, col, prop) {
          var cellProperties = {};
          if (row === 0) {
            cellProperties.renderer = defaultValueRenderer;
          }
          return cellProperties;
        },
        beforePaste: function(data, coords) {
          /* TODO: check new data before paste.

          if (mode !== 'noChanges' && (coords[0].startRow != coords[0].endRow || data.length > 1)) {
            alert('New data is available. You will change multiple rows of data.\nRefresh the data.');
            return false;
          }

          */
          
        },
        beforeChange: function(changes, source) {
          console.log('beforeChange');
          console.log({changes, source});

          /** HUGO CODE
           * 
           * 
           * 
          if (mode !== 'noChanges' && (!changes || changes[0][0] === 0)) {
            alert('New data is available. You will change multiple rows of data.\nRefresh the data.');
            return false;
          }

if (!changes || changes[0][3] === '') {
            return false;
          }

          var savedData = hot.getData();
          dataObject = savedData.slice(0);

          clearTimeout(autosaveNotification);
          savedConsole.html('Autosaved (' + changes.length + ' ' + 'cell' + (changes.length > 1 ? 's' : '') + ')');
          savedConsole.fadeIn(250);
          autosaveNotification = setTimeout(function() {
            savedConsole.fadeOut(100);
            savedConsole.html('\xa0');
          }, 3000);

           */
          

          // If it was an edit or redo or a delete content..
          if (['edit','UndoRedo.undo','CopyPaste.paste'].indexOf(source) > -1 || !source) {
            // Create operations
            changes.forEach(function(change) {
              var row = change[0];

              // Let's check if it is column change
              if (row === 0) {
                columns = hot.getSourceDataAtRow(0);
                return Fliplet.DataSources.update(currentDataSourceId, { columns: columns})
                  .then(function() {
                    // TODO: UI info about columns updated
                  });
              }

              var column = change[1];
              // Get entry id
              var entryId = hot.getDataAtCell(row,0);
              var columnName = hot.getDataAtCell(0, column);
              var data = {};
              data[columnName] = change[3];

              if (queue[row]) {
                _.assign(queue[row].data, data)
              } else {
                queue[row] = {
                  type: entryId ? 'update' : 'insert',
                  data: data,
                  row: row    // Used only here on the client
                };

                if (entryId) {
                  queue[row].dataSourceEntryId = entryId;
                }
              }

            })

            var queries = Object.keys(queue).map(function (key) { 
              return queue[key]; 
            });
            connection.query(queries).then(function (result) {
              console.log('Executed:');
              console.log({ result });
              
              // For insert operations we need to set the entry id on the table
              queries.forEach(function(query, index) {
                if (query.type !== 'insert') {
                  return;
                }

                var id = result[index].entry.id
                hot.setDataAtCell(query.row, 0, id, 'afterAPIChange');
              });

              // Clean the queue 
              queue = {};
            });
          }
        },
        beforeRemoveRow: function (index, amount) {
          var removeQueue = [];
          var entryId;
          console.log({index, amount});
          // Get entry id
          for (var i = 0; i < amount; i++) {
            entryId = hot.getDataAtCell(index + i,0);
            console.log({ entryId });
            // Create operation
            var operation = {
              type: 'delete',
              dataSourceEntryId: entryId
            }
            console.log({ operation });
            // Push operation to queue
            removeQueue.push(operation);
          }
          

          connection.query(removeQueue).then(function (result) {
            console.log('QUERIED API');
            console.log({ result });
            
          });
        },
        beforeCreateRow: function (index, amount) {
          // Do nothing. We need to get data on change hook
          console.log({index, amount});
        },
        beforeCreateCol: function (index, amount, source) {
          console.log('beforeCreateCol');
          // TODO: Maybe automatically create column name if no one is there yet
          // Do nothing. We need to get column name on change hook
          // Has we need to get the column name on change
        },
        afterCreateCol: function (index, amount, source) {
          console.log('afterCreateCol');
          // TODO: Maybe automatically create column name if no one is there yet
          // Do nothing. We need to get column name on change hook
          // Has we need to get the column name on change
        },
      };

      // INIT
      hot = new Handsontable(hotElement, hotSettings);

    })
    .catch(function onFetchError(error) {
      $('.table-entries').html('<br>Access denied. Please review your security settings if you want to access this data source.');
    });
}

Fliplet.Widget.onSaveRequest(function() {
  Fliplet.Widget.complete;
});


// Append a data source to the DOM
function renderDataSource(data) {
  var tpl = Fliplet.Widget.Templates['templates.dataSource'];
  var html = tpl(data);
  $dataSources.append(html);
}

function windowResized() {
  $('.tab-content').height($('body').height() - $('.tab-content').offset().top);
  $('.table-entries').height($('.tab-content').height());
  $('#contents:visible').height($('body').height() - $('#contents').offset().top);
}

// events
$(window).on('resize', windowResized).trigger('resize');
$('#app')
  .on('change', '.hidden-select', function() {
    var selectedValue = $(this).val();
    var selectedText = $(this).find('option:selected').text();
    $(this).parents('.select-proxy-display').find('.select-value-proxy').html(selectedText);

    if (selectedValue === '1') {
      hot.loadData(blankData);
    } else if (selectedValue === '2') {
      hot.loadData(dataDirectory);
    } else {
      hot.loadData(dataObject);
    }
  })
  .on('click', '[data-back]', function(event) {
    event.preventDefault();

    if (!dataSourceEntriesHasChanged || confirm('Are you sure? Changes that you made may not be saved.')) {
      dataSourceEntriesHasChanged = false;
      getDataSources();
    }
  })
  .on('click', '[data-browse-source]', function(event) {
    event.preventDefault();
    currentDataSourceId = $(this).closest('.data-source').data('id');
    var name = $(this).closest('.data-source').find('.data-source-name').text();

    $contents.addClass('hidden');
    $('.table-entries').html('<br>Loading data...');
    $sourceContents.removeClass('hidden');
    $sourceContents.find('h1').html(name);
    windowResized();

    // Input file temporarily disabled
    // $contents.append('<form>Import data: <input type="file" /></form><hr /><div id="entries"></div>');

    Promise.all([
        fetchCurrentDataSourceEntries(),
        fetchCurrentDataSourceUsers(),
        fetchCurrentDataSourceDetails()
      ])
      .catch(function() {
        // Something went wrong
        // EG: User try to edit an already deleted data source
        // TODO: Show some error message
        getDataSources();
      });
  })
  .on('click', '[data-delete-source]', function(event) {
    event.preventDefault();
    if (!confirm('Are you sure you want to delete this data source? All entries will be deleted.')) {
      return;
    }

    Fliplet.DataSources.delete(currentDataSourceId).then(function() {
      // Remove from UI
      $('[data-id=' + currentDataSourceId + ']').remove();

      // Remove from dataSources
      dataSources = dataSources.filter(function(ds) {
        return ds.id !== currentDataSourceId;
      });

      // Go back
      $('[data-back]').click();
    });
  })
  .on('click', '[data-create-source]', function(event) {
    event.preventDefault();
    var sourceName = prompt('Please type the new table name:');

    if (!sourceName) {
      return;
    }

    Fliplet.Organizations.get().then(function(organizations) {
      return Fliplet.DataSources.create({
        organizationId: organizations[0].id,
        name: sourceName
      });
    }).then(function(createdDataSource) {
      dataSources.push(createdDataSource);
      renderDataSource(createdDataSource);
    });
  })
  .on('change', 'input[type="file"]', function(event) {
    var $input = $(this);
    var file = $input[0].files[0];
    var formData = new FormData();

    formData.append('file', file);

    connection.import(formData).then(function(files) {
      $input.val('');
      fetchCurrentDataSourceEntries();
    });
  })
  .on('click', '[data-create-role]', function(event) {
    event.preventDefault();
    var userId = prompt('User ID');
    var permissions = prompt('Permissions', 'crudq');

    if (!userId || !permissions) {
      return;
    }

    Fliplet.DataSources.connect(currentDataSourceId).then(function(source) {
      return source.addUserRole({
        userId: userId,
        permissions: permissions
      });
    }).then(fetchCurrentDataSourceUsers, function(err) {
      alert(err.responseJSON.message);
    });
  })
  .on('click', '[data-revoke-role]', function(event) {
    event.preventDefault();
    var userId = $(this).data('revoke-role');

    if (!confirm('Are you sure you want to revoke this role?')) {
      return;
    }

    Fliplet.DataSources.connect(currentDataSourceId).then(function(source) {
      return source.removeUserRole(userId);
    }).then(function() {
      fetchCurrentDataSourceUsers();
    });
  })
  .on('submit', 'form[data-settings]', function(event) {
    event.preventDefault();
    var name = $settings.find('#name').val();
    var bundle = !$('#bundle').is(':checked');
    var definition = $settings.find('#definition').val();
    if (!name) {
      return;
    }

    try {
      definition = JSON.parse(definition);
    } catch (e) {
      Fliplet.Navigate.popup({
        popupTitle: 'Invalid settings',
        popupMessage: 'Definition MUST be a valid JSON'
      });
      return;
    }

    Fliplet.DataSources.update({
        id: currentDataSourceId,
        name: name,
        bundle: bundle,
        definition: definition
      })
      .then(function() {
        $('[data-back]').click();
      });
  })
  .on('click', '#cancel', function() {
    $('[data-back]').click();
  })
  .on('keyup change paste', '.search', function() {
    // Escape search
    var s = this.value.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

    var term = new RegExp(s, "i");
    $noResults.removeClass('show');

    var search = dataSources.filter(function(dataSource) {
      return dataSource.name.match(term);
    });

    $dataSources.empty();
    if (search.length === 0 && dataSources.length) {
      $noResults.addClass('show');
    }
    search.forEach(renderDataSource);
  })
  .on('click', '#get-backdoor', function(event) {
    event.preventDefault();
    Fliplet.API.request('v1/data-sources/' + currentDataSourceId + '/validation-code')
      .then(function(result) {
        if (result.code) {
          $settings.find('#backdoor').val(result.code);
        }
      });
  });

// Fetch data sources when the provider starts
getDataSources();
