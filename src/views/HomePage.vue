<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Dateimanager</ion-title>
        <ion-buttons slot="end">
          <ion-button @click="showAddActionSheet">
            <ion-icon slot="icon-only" :icon="addOutline" />
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <ion-button v-if="pathStack.length > 0" @click="goBack">
        <ion-icon :icon="arrowBack" slot="start" />
        Zurück
      </ion-button>

      <ion-list>
        <ion-item
          v-for="item in fileItems"
          :key="item.name"
          button
          @click="handleItemClick(item)"
        >
          <ion-icon
            :icon="item.type === 'directory' ? folderOutline : documentOutline"
            slot="start"
          />
          <ion-label>{{ item.name }}</ion-label>
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
import { addOutline, folderOutline, documentOutline, arrowBack } from 'ionicons/icons'
import { ref, computed, onMounted } from 'vue'

const pathStack = ref<string[]>([])
const currentPath = computed(() => pathStack.value.join('/'))
const fileItems = ref<{ name: string; type: 'file' | 'directory' }[]>([])

async function loadDirectory() {
  try {
    const result = await Filesystem.readdir({
      directory: Directory.Data,
      path: currentPath.value || '',
    })
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

function handleItemClick(item: { name: string; type: 'file' | 'directory' }){
  if (item.type === 'directory') {
    enterFolder(item.name)
  } else {
    openFile(item.name)
  }
}

async function openFile(name: string) {
  const fullPath = currentPath.value ? `${currentPath.value}/${name}` : name
  try {
    const fileInfo = await Filesystem.getUri({
      path: fullPath,
      directory: Directory.Data,
    })

    await FileOpener.openFile({
      path: fileInfo.uri, // ← Absoluter URI-Pfad zur Datei
    })
  } catch (err) {
    console.error('Fehler beim Öffnen der Datei:', err)
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
ion-button {
  margin: 10px;
}
</style>