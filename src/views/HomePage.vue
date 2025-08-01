<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Dateimanager</ion-title>
        <ion-buttons slot="end">
        <!-- Plus-Symbol: öffnet Auswahl (Datei oder Ordner hinzufügen) -->
          <ion-button @click="showAddActionSheet">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <!-- Breadcrumb-Pfad-Anzeige unter dem Header -->
      <div class="breadcrumb">
        /{{ currentPath }}
      </div>

      <!-- Zurück-Button wird nur angezeigt, wenn man in einem Unterordner ist -->
      <div class="back-button-wrapper" v-if="pathStack.length > 0">
        <ion-button @click="goBack" expand="block" color="medium">
          <ion-icon :icon="arrowBack" slot="start" />
          Zurück
        </ion-button>
      </div>

      <!-- Liste aller Dateien und Ordner im aktuellen Verzeichnis -->
      <ion-list>
        <ion-item
          v-for="item in fileItems"
          :key="item.name"
          button
          @click="handleItemClick(item)"
        >
          <!-- Symbol: Ordner oder Datei -->
          <ion-icon
            :icon="item.type === 'directory' ? folderOutline : documentOutline"
            slot="start"
          />
          <!-- Name der Datei/des Ordners -->
          <ion-label>{{ item.name }}</ion-label>

          <!-- Papierkorb-Symbol zum Löschen -->
          <ion-button
            fill="clear"
            color="danger"
            slot="end"
            @click.stop="deleteItem(item)"
          >
            <ion-icon :icon="trashOutline" />
          </ion-button>
        </ion-item>
      </ion-list>
    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonButton,
  IonLabel,
  IonIcon,
  IonButtons,
} from '@ionic/vue'
import { Directory, Filesystem } from '@capacitor/filesystem'
import { FilePicker } from '@capawesome/capacitor-file-picker'
import { FileOpener } from '@capawesome-team/capacitor-file-opener'
import { actionSheetController, alertController } from '@ionic/vue'
import { addOutline, folderOutline, documentOutline, arrowBack, trashOutline } from 'ionicons/icons'
import { ref, computed, onMounted } from 'vue'

// Pfad-Speicher: z. B. ['Ordner1', 'Unterordner2']
const pathStack = ref<string[]>([])
// Aktueller Pfad als zusammengesetzter String (z. B. "Ordner1/Unterordner2")
const currentPath = computed(() => pathStack.value.join('/'))
// Liste aller Dateien und Ordner im aktuellen Verzeichnis
const fileItems = ref<{ name: string; type: 'file' | 'directory' }[]>([])

async function loadDirectory() {
  try {
    // Dateien und Ordner im aktuellen Pfad lesen
    const result = await Filesystem.readdir({
      directory: Directory.Data,
      path: currentPath.value || '', // Aktueller Pfad oder Root Verzeichnis
    })
    // Ergebnis speichern: Liste von { name, type }
    fileItems.value = result.files.map((f) => ({
      name: f.name,
      type: f.type,
    }))
  } catch (error) {
    console.error('Fehler beim Lesen des Verzeichnisses:', error)
  }
}

function enterFolder(folder: string) {
  pathStack.value.push(folder)
  loadDirectory()
}

function goBack() {
  pathStack.value.pop()
  loadDirectory()
}

function handleItemClick(item: { name: string; type: 'file' | 'directory' }) {
  if (item.type === 'directory') {
    enterFolder(item.name)
  } else {
    openFile(item.name)
  }
}

// In der Funktion openFile kopieren wir die Datei in ein temporäres externes Verzeichnis (Cache),
// weil andere Apps (z. B. PDF-Viewer) keinen Zugriff auf das interne App-Verzeichnis haben.
async function openFile(name: string) {
  const internalPath = currentPath.value ? `${currentPath.value}/${name}` : name // Wenn currentPath Value leer ist liegt die Datei im Root und braucht keine Pfad-Angabe
  const tempPath = `temp-opened-file-${Date.now()}-${name}`

  try {
    // Datei aus internem Verzeichnis lesen
    const file = await Filesystem.readFile({
      path: internalPath,
      directory: Directory.Data,
    })

    // In temporäres extern zugängliches Verzeichnis schreiben
    await Filesystem.writeFile({
      path: tempPath,
      data: file.data,
      directory: Directory.Cache,
    })

    // URI für die temporäre Datei holen
    const fileUri = await Filesystem.getUri({
      path: tempPath,
      directory: Directory.Cache,
    })

    console.log('Öffne Datei von Cache:', fileUri.uri)

    await FileOpener.openFile({
      path: fileUri.uri,
    })
  } catch (error) {
    console.error('Fehler beim Öffnen der Datei:', error)
  }
}

async function deleteItem(item: { name: string; type: 'file' | 'directory' }) {
  const fullPath = currentPath.value ? `${currentPath.value}/${item.name}` : item.name // wieder nur Name wenn Datei im Root
  try {
    if (item.type === 'file') {
      await Filesystem.deleteFile({
        path: fullPath,
        directory: Directory.Data,
      })
    } else {
      await Filesystem.rmdir({
        path: fullPath,
        directory: Directory.Data,
        recursive: true,
      })
    }
    loadDirectory()
  } catch (err) {
    console.error('Fehler beim Löschen:', err)
  }
}

async function addFile() {
  try {
    const result = await FilePicker.pickFiles({ readData: true })
    if (result.files.length === 0) return

    const file = result.files[0]
    if (!file.data) {
      console.error('Fehler: Keine Daten aus dem File Picker erhalten.')
      return
    }

    // Datei ins aktuelle Verzeichnis kopieren
    const destPath = currentPath.value ? `${currentPath.value}/${file.name}` : file.name
    await Filesystem.writeFile({
      path: destPath,
      data: file.data,
      directory: Directory.Data,
    })
    loadDirectory()
  } catch (err) {
    console.error('Fehler beim Hinzufügen der Datei:', err)
  }
}

async function addFolder() {
  const alert = await alertController.create({
    header: 'Neuer Ordner',
    inputs: [
      {
        name: 'folderName',
        type: 'text',
        placeholder: 'Name des Ordners',
      },
    ],
    buttons: [
      {
        text: 'Abbrechen',
        role: 'cancel',
      },
      {
        text: 'Erstellen',
        handler: async (data) => {
          if (!data.folderName) return
          const folderPath = currentPath.value ? `${currentPath.value}/${data.folderName}` : data.folderName
          await Filesystem.mkdir({
            path: folderPath,
            directory: Directory.Data,
            recursive: true,
          })
          loadDirectory()
        },
      },
    ],
  })
  await alert.present()
}

async function showAddActionSheet() {
  const actionSheet = await actionSheetController.create({
    header: 'Hinzufügen',
    buttons: [
      {
        text: 'Datei',
        icon: 'document',
        handler: addFile,
      },
      {
        text: 'Ordner',
        icon: 'folder',
        handler: addFolder,
      },
      {
        text: 'Abbrechen',
        icon: 'close',
        role: 'cancel',
      },
    ],
  })
  await actionSheet.present()
}

onMounted(loadDirectory)
</script>

<style scoped>
  ion-toolbar {
      padding-top: 1.25rem;
    }

  /* Pfadanzeige als Breadcrumb-Leiste */
  .breadcrumb {
    background-color: var(--ion-color-step-100); /* heller Grauton im Light-Mode, dunkler im Dark-Mode */
    color: var(--ion-text-color);
    padding: 8px 12px;
    margin: 10px 0;
    border-radius: 6px;
    font-size: 14px;
    overflow-x: auto;
    white-space: nowrap;
  }

  /* Abstand für den Zurück-Button */
  .back-button-wrapper {
    margin: 10px 0 20px;
  }
</style>
